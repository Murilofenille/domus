import os
import json
import time
from typing import Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import requests

try:
    from tuya_connector import TuyaOpenAPI
except ImportError:
    TuyaOpenAPI = None

load_dotenv()

app = FastAPI(title="DOMUS | Smart Home", version="3.2.0", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def vercel_route_fix_middleware(request, call_next):
    # Restaura a rota original caso o Vercel tenha reescrito o path de destino
    matched = request.headers.get("x-matched-path") or request.headers.get("x-original-uri")
    if matched:
        # Se for /api/status ou /status, ajusta no escopo ASGI
        clean_path = matched.split("?")[0]
        if clean_path and clean_path not in ["/api/index.py", "/api"]:
            request.scope["path"] = clean_path
    return await call_next(request)

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
}

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

class CommandRequest(BaseModel):
    device_id: str
    code: str
    value: bool

class DeviceConfigPayload(BaseModel):
    device_rooms: Dict[str, str] = {}
    channel_names: Dict[str, Dict[str, str]] = {}
    hidden_channels: Dict[str, list] = {}
    channel_rooms: Dict[str, Dict[str, str]] = {}

# Instância única lazy do Tuya OpenAPI
_openapi_instance = None

def get_tuya():
    global _openapi_instance
    if _openapi_instance is None:
        access_id = os.getenv("TUYA_ACCESS_ID")
        access_secret = os.getenv("TUYA_ACCESS_SECRET")
        endpoint = os.getenv("TUYA_API_ENDPOINT", "https://openapi.tuyaus.com")
        if not access_id or not access_secret:
            raise RuntimeError("TUYA_ACCESS_ID e TUYA_ACCESS_SECRET precisam estar configurados nas variáveis de ambiente.")
        if TuyaOpenAPI is None:
            raise RuntimeError("tuya_connector não está instalado no ambiente.")
        _openapi_instance = TuyaOpenAPI(endpoint, access_id, access_secret)
        _openapi_instance.connect()
    return _openapi_instance

# Cache em memória entre invocações da mesma instância Lambda
memory_devices_cache: Dict[str, Any] = {}
last_cache_timestamp: float = 0.0

def fetch_single_device(key: str, device_id: str):
    try:
        api = get_tuya()
        res = api.get(f"/v1.0/devices/{device_id}/status")
        if not res.get("success") and res.get("code") in [1010, 1011]:
            api.connect()
            res = api.get(f"/v1.0/devices/{device_id}/status")
        if res.get("success"):
            status_list = res.get("result", [])
            dps = {item["code"]: item["value"] for item in status_list}
            return key, {"device_id": device_id, "online": True, "switches": dps, "updated_at": time.time()}
    except Exception as e:
        print(f"Erro ao consultar dispositivo {key} ({device_id}): {e}")
    return key, {"device_id": device_id, "online": False, "switches": {}, "updated_at": time.time()}

# Persistência via Vercel KV / Upstash (se disponível) ou fallback local
KV_URL = os.getenv("KV_REST_API_URL")
KV_TOKEN = os.getenv("KV_REST_API_TOKEN")

def load_stored_config() -> Dict[str, Any]:
    # 1. Tentar Vercel KV se configurado
    if KV_URL and KV_TOKEN:
        try:
            r = requests.get(f"{KV_URL}/get/domus_device_config", headers={"Authorization": f"Bearer {KV_TOKEN}"}, timeout=2.5)
            if r.status_code == 200:
                val = r.json().get("result")
                if val:
                    return json.loads(val)
        except Exception as e:
            print(f"Erro ao ler do Vercel KV: {e}")

    # 2. Tentar arquivo devices_mapping.json local
    config_file = os.path.join(os.path.dirname(__file__), "..", "backend", "devices_mapping.json")
    if os.path.exists(config_file):
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    return {
        "device_rooms": DEFAULT_DEVICE_ROOMS,
        "channel_names": DEFAULT_CHANNEL_NAMES,
        "hidden_channels": {"led_closet": ["switch_inching", "switch_type"]},
        "channel_rooms": {}
    }

def save_stored_config(data: Dict[str, Any]) -> bool:
    if KV_URL and KV_TOKEN:
        try:
            r = requests.post(
                f"{KV_URL}/set/domus_device_config",
                headers={"Authorization": f"Bearer {KV_TOKEN}", "Content-Type": "application/json"},
                data=json.dumps(json.dumps(data)),
                timeout=3.0
            )
            return r.status_code == 200
        except Exception as e:
            print(f"Erro ao salvar no Vercel KV: {e}")
            return False
    return True

@app.get("/")
@app.get("/api")
@app.get("/api/health")
@app.get("/health")
async def health():
    return {"status": "ok", "app": "DOMUS | Smart Home", "mode": "serverless", "time": time.time()}

@app.get("/api/status")
@app.get("/status")
async def get_status(device_id: Optional[str] = None):
    global memory_devices_cache, last_cache_timestamp
    now = time.time()

    # Revalidar cache se expirou há mais de 3.5 segundos ou estiver vazio
    if now - last_cache_timestamp > 3.5 or not memory_devices_cache:
        try:
            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = [
                    executor.submit(fetch_single_device, k, info["id"])
                    for k, info in DEVICES.items()
                ]
                new_cache = {}
                for future in futures:
                    k, dev_data = future.result()
                    new_cache[k] = dev_data
                    new_cache[dev_data["device_id"]] = dev_data
                memory_devices_cache = new_cache
                last_cache_timestamp = now
        except Exception as e:
            print(f"Erro ao buscar status na Tuya: {e}")
            return {
                "online": False,
                "devices": dict(memory_devices_cache),
                "error": str(e),
                "updated_at": now
            }

    if device_id:
        cached = memory_devices_cache.get(device_id)
        if cached:
            return cached
        return {"device_id": device_id, "online": True, "switches": {}, "updated_at": now}

    return {
        "online": True,
        "devices": dict(memory_devices_cache),
        "updated_at": last_cache_timestamp
    }

@app.post("/api/command")
@app.post("/command")
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
    if req.device_id in memory_devices_cache and "switches" in memory_devices_cache[req.device_id]:
        memory_devices_cache[req.device_id]["switches"][req.code] = req.value
        memory_devices_cache[req.device_id]["updated_at"] = time.time()

    try:
        api = get_tuya()
        response = api.post(f"/v1.0/devices/{req.device_id}/commands", payload)
        if not response.get("success"):
            api.connect()
            response = api.post(f"/v1.0/devices/{req.device_id}/commands", payload)

        if response.get("success"):
            return {"success": True, "device_id": req.device_id, "code": req.code, "value": req.value}
        else:
            raise HTTPException(status_code=400, detail=response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/config")
@app.get("/config")
async def get_config():
    config = load_stored_config()
    device_rooms = config.get("device_rooms", DEFAULT_DEVICE_ROOMS)
    channel_names = config.get("channel_names", DEFAULT_CHANNEL_NAMES)
    hidden_channels = config.get("hidden_channels", {"led_closet": ["switch_inching", "switch_type"]})
    channel_rooms = config.get("channel_rooms", {})

    devices_list = []
    for key, info in DEVICES.items():
        cached = memory_devices_cache.get(key) or memory_devices_cache.get(info["id"]) or {}
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
@app.post("/config")
async def save_config(payload: DeviceConfigPayload):
    data_to_save = {
        "device_rooms": payload.device_rooms,
        "channel_names": payload.channel_names,
        "hidden_channels": payload.hidden_channels,
        "channel_rooms": payload.channel_rooms,
        "updated_at": time.time()
    }
    save_stored_config(data_to_save)
    return {"success": True, "message": "Configurações salvas com sucesso!"}
