import os
import json
import time
import threading
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from tuya_connector import TuyaOpenAPI

load_dotenv()

ACCESS_ID = os.getenv("TUYA_ACCESS_ID")
ACCESS_SECRET = os.getenv("TUYA_ACCESS_SECRET")
API_ENDPOINT = os.getenv("TUYA_API_ENDPOINT", "https://openapi.tuyaus.com")

if not ACCESS_ID or not ACCESS_SECRET:
    raise RuntimeError("TUYA_ACCESS_ID e TUYA_ACCESS_SECRET precisam estar definidos no .env")

openapi = TuyaOpenAPI(API_ENDPOINT, ACCESS_ID, ACCESS_SECRET)
openapi.connect()

app = FastAPI(title="DOMUS | Smart Home", version="3.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEVICES = {
    "quarto_murilo": {"name": "Quarto Murilo", "id": "7173100234ab95105538"},
    "escritorio_murilo": {"name": "Escritório Murilo", "id": "eba0bc9062cb902519bv8a"},
    "sala": {"name": "Interruptor Sala", "id": "eb4363d2fae69d1b3ak5lg"},
    "cozinha": {"name": "Cozinha", "id": "eb0253512b47c620f1b3tg"},
    "lavanderia": {"name": "Lavanderia", "id": "eb06af9cdbe3a70513uvmv"},
    "quarto_marina": {"name": "Quarto Marina", "id": "0076231634ab9510916c"},
    "tomada_marina": {"name": "Tomada Marina", "id": "eba520de38c7edcd5cdesn"},
    "quarto_alfeo": {"name": "Quarto Alfeo", "id": "0076231634ab9510ba04"},
    "tomada_alfeo": {"name": "Tomada Alfeo", "id": "eb2bf7de07a19292ac2kf4"},
    "banheiro_alfeo": {"name": "Banheiro Alfeo", "id": "eb4bb2c6b85ca80c08xen2"},
    "banheiro_social": {"name": "Banheiro Social", "id": "ebea951fa1e1900c21l4op"},
    "suite_master": {"name": "Suíte Master", "id": "eb7b83c1dcb03d24231db5"},
    "banheiro_master": {"name": "Banheiro Master", "id": "eb359369a7c7cd5cacz5cb"},
    "closet": {"name": "Closet", "id": "0076231634ab951d1684"},
    "led_closet": {"name": "Led Guarda Roupa", "id": "eb3a48b14417d7cd46g13x"},
    "corredor_principal": {"name": "Corredor Principal", "id": "7753207334ab951d4101"},
    "corredor_suite": {"name": "Corredor Suíte", "id": "eb7ec51b1a94acaf7ffjqx"},
    "corredor_claraboia": {"name": "Corredor Claraboia", "id": "ebbfb1b732983a19det4ng"},
    "termostato": {"name": "Termostato", "id": "ebb44c0ed17053d7ba7c57"},
    "temperatura_piscina": {"name": "Temperatura Piscina", "id": "ebcefc3209dad58d10wpgv"},
}

class CommandRequest(BaseModel):
    device_id: str
    code: str
    value: bool

# Cache em memória compartilhado
devices_cache: Dict[str, Any] = {}
cache_lock = threading.Lock()

def fetch_device(key: str, device_id: str):
    try:
        res = openapi.get(f"/v1.0/devices/{device_id}/status")
        if res.get("success"):
            status_list = res.get("result", [])
            dps = {item["code"]: item["value"] for item in status_list}
            data = {"device_id": device_id, "online": True, "switches": dps, "updated_at": time.time()}
            with cache_lock:
                devices_cache[key] = data
                devices_cache[device_id] = data
        else:
            if res.get("code") in [1010, 1011]:
                openapi.connect()
    except Exception as e:
        print(f"Erro ao consultar {key}: {e}")

# Worker de sincronização contínua em segundo plano
def background_poller():
    while True:
        for key, info in DEVICES.items():
            fetch_device(key, info["id"])
            time.sleep(0.12) # Pausa suave para respeitar rate-limit da Tuya
        time.sleep(2.0)

# Iniciar thread em background
poller_thread = threading.Thread(target=background_poller, daemon=True)
poller_thread.start()

# Preencher estado imediato do Quarto Murilo e Sala para resposta relâmpago
fetch_device("quarto_murilo", "7173100234ab95105538")
fetch_device("sala", "eb4363d2fae69d1b3ak5lg")

@app.get("/api/health")
async def health():
    return {"status": "ok", "devices_count": len(devices_cache), "time": time.time()}

@app.get("/api/status")
async def get_status(device_id: Optional[str] = None):
    # Retorno INSTANTÂNEO em menos de 1ms diretamente da memória RAM
    with cache_lock:
        if device_id:
            cached = devices_cache.get(device_id)
            if cached:
                return cached
            return {"device_id": device_id, "online": True, "switches": {}, "updated_at": time.time()}

        return {
            "online": True,
            "devices": dict(devices_cache),
            "updated_at": time.time()
        }

@app.post("/api/command")
async def send_command(req: CommandRequest):
    payload = {
        "commands": [
            {
                "code": req.code,
                "value": req.value
            }
        ]
    }
    
    # Atualização otimista imediata no cache de memória
    with cache_lock:
        for k in [req.device_id]:
            if k in devices_cache and "switches" in devices_cache[k]:
                devices_cache[k]["switches"][req.code] = req.value
                devices_cache[k]["updated_at"] = time.time()

    try:
        response = openapi.post(f"/v1.0/devices/{req.device_id}/commands", payload)
        if not response.get("success"):
            openapi.connect()
            response = openapi.post(f"/v1.0/devices/{req.device_id}/commands", payload)

        if response.get("success"):
            return {"success": True, "device_id": req.device_id, "code": req.code, "value": req.value}
        else:
            raise HTTPException(status_code=400, detail=response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "devices_mapping.json")


class DeviceConfigPayload(BaseModel):
    device_rooms: Dict[str, str] = {}
    channel_names: Dict[str, Dict[str, str]] = {}
    hidden_channels: Dict[str, list] = {}
    channel_rooms: Dict[str, Dict[str, str]] = {}

DEFAULT_DEVICE_ROOMS = {
    "quarto_murilo": "bedroom-01",
    "escritorio_murilo": "bedroom-01",
    "sala": "living",
    "cozinha": "gourmet",
    "lavanderia": "laundry",
    "quarto_marina": "bedroom-02",
    "tomada_marina": "bedroom-02",
    "quarto_alfeo": "suite",
    "tomada_alfeo": "suite",
    "banheiro_alfeo": "bath-suite",
    "banheiro_social": "bath-social",
    "suite_master": "master",
    "banheiro_master": "bath-master",
    "closet": "closet",
    "led_closet": "closet",
    "corredor_principal": "hall",
    "corredor_suite": "rear-hall",
    "corredor_claraboia": "skylight-east",
}

DEFAULT_CHANNEL_NAMES = {
    "sala": {
        "switch_1": "Luz Sala TV",
        "switch_2": "Spots Sala",
        "switch_3": "Mesa de Jantar",
        "switch_4": "Lustre Jantar",
        "switch_5": "Cortineiro Sala",
        "switch_6": "Sanca de Gesso",
        "switch_7": "Luz Hall Entrada",
        "switch_8": "Spots Parede"
    },
    "quarto_murilo": {
        "switch_1": "Luz Central Quarto",
        "switch_2": "Spots Cabeceira",
        "switch_3": "Fita LED Sanca"
    },
    "escritorio_murilo": {
        "switch_1": "Luz Mesa Trabalho",
        "switch_2": "Tomada Monitor/PC"
    },
    "cozinha": {
        "switch_1": "Ilha Central",
        "switch_2": "Bancada Pia",
        "switch_3": "Armários Superiores"
    },
    "quarto_marina": {
        "switch_1": "Luz Central",
        "switch_2": "Spots Cama"
    },
    "closet": {
        "switch_1": "Luz Geral Closet",
        "switch_2": "Spots Espelho"
    },
    "led_closet": {
        "switch_1": "Barra LED Guarda-Roupa"
    },
    "lavanderia": {
        "switch_1": "Luz Principal Lavanderia"
    },
    "corredor_principal": {
        "switch_1": "Luz Corredor Central"
    },
    "corredor_suite": {
        "switch_1": "Luz Corredor Suíte Master"
    }
}

def load_saved_config() -> Dict[str, Any]:
    rooms = dict(DEFAULT_DEVICE_ROOMS)
    channels = {k: dict(v) for k, v in DEFAULT_CHANNEL_NAMES.items()}
    hidden = {}
    chan_rooms = {}
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                if "device_rooms" in saved and isinstance(saved["device_rooms"], dict):
                    rooms.update(saved["device_rooms"])
                if "channel_names" in saved and isinstance(saved["channel_names"], dict):
                    for dev_k, dev_chans in saved["channel_names"].items():
                        if dev_k not in channels:
                            channels[dev_k] = {}
                        if isinstance(dev_chans, dict):
                            channels[dev_k].update(dev_chans)
                if "hidden_channels" in saved and isinstance(saved["hidden_channels"], dict):
                    hidden = saved["hidden_channels"]
                if "channel_rooms" in saved and isinstance(saved["channel_rooms"], dict):
                    chan_rooms = saved["channel_rooms"]
        except Exception as e:
            print(f"Erro ao ler {CONFIG_FILE}: {e}")
    return {
        "device_rooms": rooms,
        "channel_names": channels,
        "hidden_channels": hidden,
        "channel_rooms": chan_rooms
    }

@app.get("/api/config")
async def get_config():
    config = load_saved_config()
    device_rooms = config.get("device_rooms", DEFAULT_DEVICE_ROOMS)
    channel_names = config.get("channel_names", DEFAULT_CHANNEL_NAMES)
    hidden_channels = config.get("hidden_channels", {})
    channel_rooms = config.get("channel_rooms", {})
    
    # Montar lista completa de dispositivos com status e canais detectados
    devices_list = []
    with cache_lock:
        for key, info in DEVICES.items():
            cached = devices_cache.get(key) or devices_cache.get(info["id"]) or {}
            switches = cached.get("switches", {})
            devices_list.append({
                "key": key,
                "name": info["name"],
                "id": info["id"],
                "online": cached.get("online", True),
                "room_id": device_rooms.get(key, ""),
                "switches": switches,
                "custom_channel_names": channel_names.get(key, {}),
                "hidden_channels": hidden_channels.get(key, []),
                "channel_rooms": channel_rooms.get(key, {})
            })
            
    return {
        "device_rooms": device_rooms,
        "channel_names": channel_names,
        "hidden_channels": hidden_channels,
        "channel_rooms": channel_rooms,
        "devices": devices_list
    }

@app.post("/api/config")
async def save_config(payload: DeviceConfigPayload):
    try:
        data_to_save = {
            "device_rooms": payload.device_rooms,
            "channel_names": payload.channel_names,
            "hidden_channels": payload.hidden_channels,
            "channel_rooms": payload.channel_rooms,
            "updated_at": time.time()
        }
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(data_to_save, f, indent=2, ensure_ascii=False)
        return {"success": True, "message": "Configurações salvas com sucesso!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha ao salvar configurações: {e}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    print(f"[*] Iniciando Servidor Tuya Domus na porta {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
