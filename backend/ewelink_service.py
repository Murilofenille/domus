"""
DOMUS | Módulo de Integração eWeLink Cloud (Sonoff / CoolKit v2)
Fornece sincronização de status e envio de comandos para os dispositivos Sonoff da Área de Lazer.
"""

import os
import json
import time
import base64
import hashlib
import hmac
import requests
from typing import Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

APP_ID = "R8Oq3y0eSZSYdKccHlrQzT1ACCOUT9Gv"
APP_SECRET = "1ve5Qk9GXfUhKAn1svnKwpAlxXkMarru"

API_HOSTS = {
    "us": "https://us-apia.coolkit.cc",
    "eu": "https://eu-apia.coolkit.cc",
    "as": "https://as-apia.coolkit.cc",
    "cn": "https://cn-apia.coolkit.cn",
}


def make_sign(secret: str, data: bytes) -> str:
    sig = hmac.new(secret.encode("utf-8"), data, hashlib.sha256).digest()
    return base64.b64encode(sig).decode("utf-8")


class EwelinkClient:
    def __init__(self, username: Optional[str] = None, password: Optional[str] = None, country_code: str = "+55"):
        self.username = username or os.getenv("EWELINK_USERNAME")
        self.password = password or os.getenv("EWELINK_PASSWORD")
        self.country_code = country_code or os.getenv("EWELINK_COUNTRY_CODE", "+55")
        self.access_token: Optional[str] = None
        self.host: str = API_HOSTS["us"]
        self.region: str = "us"
        self.last_login_time: float = 0
        self.cached_devices_meta: Dict[str, Any] = {}
        self.session = requests.Session()

    @property
    def is_configured(self) -> bool:
        return bool(self.username and self.password)

    def login(self, force: bool = False) -> bool:
        if not self.is_configured:
            return False

        # Token costuma ser válido por semanas, mas renovamos se passar de 24 horas
        if not force and self.access_token and (time.time() - self.last_login_time < 86400):
            return True

        payload = {
            "password": self.password,
            "countryCode": self.country_code,
        }
        if "@" in self.username:
            payload["email"] = self.username.strip()
        else:
            payload["phoneNumber"] = "+" + self.username.strip().lstrip("+")

        data = json.dumps(payload).encode("utf-8")
        signature = make_sign(APP_SECRET, data)

        headers = {
            "Authorization": f"Sign {signature}",
            "Content-Type": "application/json",
            "X-CK-Appid": APP_ID,
        }

        url = f"{self.host}/v2/user/login"
        try:
            res = requests.post(url, data=data, headers=headers, timeout=8)
            res_data = res.json()

            # Redirecionamento de região da conta (ex: se conta for da América do Sul mas roteada em outra)
            if res_data.get("error") == 10004:
                new_region = res_data.get("data", {}).get("region", "us")
                self.region = new_region
                self.host = API_HOSTS.get(new_region, self.host)
                res = requests.post(f"{self.host}/v2/user/login", data=data, headers=headers, timeout=8)
                res_data = res.json()

            if res_data.get("error") == 0:
                self.access_token = res_data["data"].get("at")
                self.last_login_time = time.time()
                return True
            else:
                print(f"[eWeLink] Erro no login: {res_data.get('msg')} (código {res_data.get('error')})")
                return False
        except Exception as e:
            print(f"[eWeLink] Exceção ao conectar à nuvem: {e}")
            return False

    def fetch_devices(self) -> Dict[str, Dict[str, Any]]:
        """
        Retorna dicionário de dispositivos normalizados para o formato DOMUS:
        {
          "device_id": {
             "device_id": "1000e4a34e",
             "name": "Luz Escada",
             "online": True,
             "switches": {"switch_1": False},
             "updated_at": 1725...
          }
        }
        """
        if not self.login():
            return {}

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "X-CK-Appid": APP_ID,
        }
        url = f"{self.host}/v2/device/thing?num=0"

        try:
            res = self.session.get(url, headers=headers, timeout=8)
            data = res.json()

            # Se o token expirou (ex: erro 401 ou 403), força novo login
            if data.get("error") in [401, 403, 10004]:
                if self.login(force=True):
                    headers["Authorization"] = f"Bearer {self.access_token}"
                    res = self.session.get(url, headers=headers, timeout=8)
                    data = res.json()

            if data.get("error") != 0:
                print(f"[eWeLink] Erro ao buscar dispositivos: {data.get('msg')}")
                return {}

            result: Dict[str, Dict[str, Any]] = {}
            things = data.get("data", {}).get("thingList", [])

            for item in things:
                item_data = item.get("itemData", {})
                dev_id = item_data.get("deviceid")
                if not dev_id:
                    continue

                name = item_data.get("name", "Sonoff")
                online = bool(item_data.get("online", False))
                params = item_data.get("params", {})
                uiid = item_data.get("extra", {}).get("uiid")

                # Normalizar status dos switches para "switch_1", "switch_2" e "switch"
                switches: Dict[str, bool] = {}
                if "switch" in params:
                    # Interruptor de canal único (ex: Sonoff Mini, Basic, TX 1C)
                    val = (params.get("switch") == "on")
                    switches["switch"] = val
                    switches["switch_1"] = val
                elif "switches" in params:
                    # Interruptor multi-canal (ex: Sonoff 4CH, TX 2C/3C)
                    for sw in params.get("switches", []):
                        outlet = sw.get("outlet", 0) + 1
                        switches[f"switch_{outlet}"] = (sw.get("switch") == "on")
                    if "switch_1" in switches:
                        switches["switch"] = switches["switch_1"]

                dev_dict = {
                    "device_id": dev_id,
                    "name": name,
                    "online": online,
                    "switches": switches,
                    "brand": item_data.get("brandName", "SONOFF"),
                    "uiid": uiid,
                    "updated_at": time.time(),
                }

                result[dev_id] = dev_dict
                # Mapear também por slug/chave amigável baseado no nome
                safe_key = name.lower().replace(" ", "_").replace("ã", "a").replace("ç", "c").replace("í", "i").replace("é", "e").replace("ó", "o")
                result[safe_key] = dev_dict
                self.cached_devices_meta[dev_id] = item_data

            return result
        except Exception as e:
            print(f"[eWeLink] Exceção ao consultar dispositivos: {e}")
            return {}

    def set_switch(self, device_id: str, code: str, value: bool) -> bool:
        """
        Envia comando de ligar/desligar para um interruptor de 1 canal ou multi-canal.
        """
        if not self.login():
            return False

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "X-CK-Appid": APP_ID,
            "Content-Type": "application/json",
        }
        url = f"{self.host}/v2/device/thing/status"

        # Descobrir se é multi-canal ou single-channel
        is_multi = False
        outlet_index = 0
        if code.startswith("switch_"):
            try:
                num = int(code.split("_")[1])
                outlet_index = max(0, num - 1)
            except Exception:
                outlet_index = 0

        cached_meta = self.cached_devices_meta.get(device_id, {})
        params_meta = cached_meta.get("params", {})
        if "switches" in params_meta or outlet_index > 0 or device_id == "1000e8f9b1":
            is_multi = True

        str_val = "on" if value else "off"
        if is_multi:
            body = {
                "type": 1,
                "id": device_id,
                "params": {
                    "switches": [{"outlet": outlet_index, "switch": str_val}]
                }
            }
        else:
            body = {
                "type": 1,
                "id": device_id,
                "params": {
                    "switch": str_val
                }
            }

        try:
            res = self.session.post(url, headers=headers, json=body, timeout=8)
            resp = res.json()
            if resp.get("error") == 0:
                return True
            print(f"[eWeLink] Falha ao enviar comando para {device_id}: {resp}")
            return False
        except Exception as e:
            print(f"[eWeLink] Exceção ao acionar {device_id}: {e}")
            return False


# Instância global reutilizável
ewelink_instance = EwelinkClient()
