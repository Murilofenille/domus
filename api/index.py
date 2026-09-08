import os
import json
import time
from typing import Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import requests

try:
    from tuya_connector import TuyaOpenAPI
except ImportError:
    TuyaOpenAPI = None

try:
    from api.ewelink_service import ewelink_instance
except ImportError:
    try:
        from ewelink_service import ewelink_instance
    except ImportError:
        ewelink_instance = None

load_dotenv()

app = FastAPI(title="DOMUS | Smart Home", version="3.3.0", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def vercel_route_fix_middleware(request: Request, call_next):
    # Restaura a rota original requisitada pelo navegador no ambiente Serverless da Vercel
    original_uri = (
        request.headers.get("x-forwarded-uri")
        or request.headers.get("x-original-uri")
        or request.headers.get("x-invoke-path")
        or ""
    )

    if not original_uri and "x-now-route-matches" in request.headers:
        matches = request.headers.get("x-now-route-matches", "")
        for part in matches.split("&"):
            if part.startswith("1="):
                original_uri = "/api/" + part[2:]
                break

    if not original_uri:
        matched = request.headers.get("x-matched-path", "")
        if matched and matched not in ["/api/index.py", "/api"]:
            original_uri = matched

    if original_uri:
        clean_path = original_uri.split("?")[0]
        if clean_path and clean_path not in ["/api/index.py", "/api"]:
            request.scope["path"] = clean_path

    return await call_next(request)

# Dispositivos Tuya da Área de Lazer
DEVICES = {
    "termostato": {"name": "Termostato", "id": "ebb44c0ed17053d7ba7c57"},
    "temperatura_piscina": {"name": "Temperatura Piscina", "id": "ebcefc3209dad58d10wpgv"},
}

DEFAULT_DEVICE_ROOMS = {
    "1000e4a34e": "escada",
    "1000e4bd27": "piscina",
    "1000e4a34c": "gourmet",
    "1000e8f9b1": "piscina",
    "termostato": "piscina",
    "temperatura_piscina": "piscina",
}

DEFAULT_CHANNEL_NAMES = {
    "1000e8f9b1": {
        "switch_1": "Filtro",
        "switch_2": "Hidro Costa",
        "switch_3": "Aquecedor",
        "switch_4": "Hidro Pé"
    },
    "1000e4a34e": {
        "switch": "Luz Escada",
        "switch_1": "Luz Escada"
    },
    "1000e4bd27": {
        "switch": "Arandela Piscina",
        "switch_1": "Arandela Piscina"
    },
    "1000e4a34c": {
        "switch": "Iluminação Salão",
        "switch_1": "Iluminação Salão"
    },
    "termostato": {
        "switch": "Termostato Tuya"
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
        access_id = os.getenv("TUYA_ACCESS_ID", "cw8xfypa89ykskhtmu4q")
        access_secret = os.getenv("TUYA_ACCESS_SECRET", "67d91e7bf68640bd9fa742affa83b941")
        endpoint = os.getenv("TUYA_API_ENDPOINT", "https://openapi.tuyaus.com")
        if not access_id or not access_secret:
            raise RuntimeError("TUYA_ACCESS_ID e TUYA_ACCESS_SECRET precisam estar configurados.")
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

    # 2. Tentar arquivo devices_mapping.json local em api/ ou backend/
    for p in [
        os.path.join(os.path.dirname(__file__), "devices_mapping.json"),
        os.path.join(os.path.dirname(__file__), "..", "backend", "devices_mapping.json")
    ]:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass

    return {
        "device_rooms": DEFAULT_DEVICE_ROOMS,
        "channel_names": DEFAULT_CHANNEL_NAMES,
        "hidden_channels": {},
        "channel_rooms": {}
    }

def save_stored_config(data: Dict[str, Any]) -> bool:
    if KV_URL and KV_TOKEN:
        try:
            r = requests.post(
                f"{KV_URL}/set/domus_device_config",
                headers={"Authorization": f"Bearer {KV_TOKEN}", "Content-Type": "application/json"},
                json=json.dumps(data),
                timeout=2.5
            )
            return r.status_code == 200
        except Exception as e:
            print(f"Erro ao gravar no Vercel KV: {e}")

    for p in [
        os.path.join(os.path.dirname(__file__), "devices_mapping.json"),
        os.path.join(os.path.dirname(__file__), "..", "backend", "devices_mapping.json")
    ]:
        try:
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return True
        except Exception:
            pass

    return False

@app.get("/")
@app.get("/api")
async def root():
    return {
        "status": "online",
        "service": "DOMUS Smart Home Cloud API",
        "version": "3.3.0",
        "timestamp": time.time()
    }

@app.get("/api/status")
@app.get("/status")
async def get_status(device_id: Optional[str] = None):
    global memory_devices_cache, last_cache_timestamp
    now = time.time()

    # Revalidar cache se expirou há mais de 3.5 segundos ou estiver vazio
    if now - last_cache_timestamp > 3.5 or not memory_devices_cache:
        try:
            with ThreadPoolExecutor(max_workers=5) as executor:
                futures = [
                    executor.submit(fetch_single_device, k, info["id"])
                    for k, info in DEVICES.items()
                ]
                new_cache = {}
                for future in futures:
                    k, dev_data = future.result()
                    new_cache[k] = dev_data
                    new_cache[dev_data["device_id"]] = dev_data

                # Mesclar dispositivos eWeLink (Sonoff da Área de Lazer)
                if ewelink_instance and ewelink_instance.is_configured:
                    try:
                        ew_devs = ewelink_instance.fetch_devices()
                        for dev_k, dev_val in ew_devs.items():
                            new_cache[dev_k] = dev_val
                    except Exception as ew_err:
                        print(f"[eWeLink Vercel] Erro ao buscar dispositivos: {ew_err}")

                memory_devices_cache = new_cache
                last_cache_timestamp = now
        except Exception as e:
            print(f"Erro ao buscar status: {e}")
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
@app.post("/api")
async def send_command(req: CommandRequest):
    # Atualização otimista imediata no cache de memória
    if req.device_id in memory_devices_cache and "switches" in memory_devices_cache[req.device_id]:
        memory_devices_cache[req.device_id]["switches"][req.code] = req.value
        memory_devices_cache[req.device_id]["updated_at"] = time.time()

    # Roteamento Inteligente: eWeLink vs Tuya
    is_ewelink = (
        req.device_id.startswith("1000") or
        req.device_id in ["1000e4a34e", "1000e4bd27", "1000e4a34c", "1000e8f9b1"] or
        (req.device_id in memory_devices_cache and memory_devices_cache[req.device_id].get("brand") == "SONOFF") or
        (ewelink_instance and req.device_id in ewelink_instance.cached_devices_meta)
    )

    if is_ewelink and ewelink_instance and ewelink_instance.is_configured:
        success = ewelink_instance.set_switch(req.device_id, req.code, req.value)
        if success:
            return {"success": True, "provider": "ewelink", "device_id": req.device_id, "code": req.code, "value": req.value}
        else:
            raise HTTPException(status_code=400, detail=f"Falha ao acionar dispositivo no eWeLink ({req.device_id})")

    # Caso contrário, roteia para Tuya
    payload = {
        "commands": [
            {
                "code": req.code,
                "value": req.value
            }
        ]
    }
    try:
        api = get_tuya()
        response = api.post(f"/v1.0/devices/{req.device_id}/commands", payload)
        if not response.get("success"):
            api.connect()
            response = api.post(f"/v1.0/devices/{req.device_id}/commands", payload)

        if response.get("success"):
            return {"success": True, "provider": "tuya", "device_id": req.device_id, "code": req.code, "value": req.value}
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
    hidden_channels = config.get("hidden_channels", {})
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
            "room_id": device_rooms.get(key, "piscina"),
            "switches": switches,
            "custom_channel_names": channel_names.get(key, {}),
            "hidden_channels": hidden_channels.get(key, []),
            "channel_rooms": channel_rooms.get(key, {})
        })

    # Incluir dispositivos eWeLink na lista
    if ewelink_instance and ewelink_instance.is_configured:
        if not ewelink_instance.cached_devices_meta:
            try:
                ewelink_instance.fetch_devices()
            except Exception:
                pass

        for dev_id, item_meta in ewelink_instance.cached_devices_meta.items():
            cached = memory_devices_cache.get(dev_id) or {}
            switches = cached.get("switches", {})
            devices_list.append({
                "key": dev_id,
                "name": cached.get("name", item_meta.get("name", "Sonoff")),
                "id": dev_id,
                "online": cached.get("online", True),
                "room_id": device_rooms.get(dev_id, "piscina"),
                "switches": switches,
                "custom_channel_names": channel_names.get(dev_id, {}),
                "hidden_channels": hidden_channels.get(dev_id, []),
                "channel_rooms": channel_rooms.get(dev_id, {})
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
    return {"success": True}
