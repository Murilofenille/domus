"""
DOMUS - Teste e Integração eWeLink Cloud (CoolKit v2 API)
Permite listar os dispositivos Sonoff / eWeLink da sua conta e testar comandos sem necessidade de aprovação de conta de desenvolvedor.
"""

import sys
import os
import json
import base64
import hashlib
import hmac
import requests
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


def login_ewelink(username: str, password: str, country_code: str = "+55"):
    region = "us"
    host = API_HOSTS[region]

    payload = {
        "password": password,
        "countryCode": country_code,
    }
    if "@" in username:
        payload["email"] = username.strip()
    else:
        payload["phoneNumber"] = ("+" + username.strip().lstrip("+"))

    data = json.dumps(payload).encode("utf-8")
    signature = make_sign(APP_SECRET, data)

    headers = {
        "Authorization": f"Sign {signature}",
        "Content-Type": "application/json",
        "X-CK-Appid": APP_ID,
    }

    url = f"{host}/v2/user/login"
    print(f"\n[*] Conectando à eWeLink Cloud ({host})...")
    res = requests.post(url, data=data, headers=headers, timeout=10)
    res_data = res.json()

    # Tratamento de redirecionamento automático de região da conta
    if res_data.get("error") == 10004:
        new_region = res_data.get("data", {}).get("region", "us")
        host = API_HOSTS.get(new_region, host)
        print(f"[*] Redirecionando para servidor da região '{new_region}' ({host})...")
        res = requests.post(f"{host}/v2/user/login", data=data, headers=headers, timeout=10)
        res_data = res.json()

    if res_data.get("error") != 0:
        msg = res_data.get("msg", "Erro desconhecido")
        err_code = res_data.get("error")
        raise RuntimeError(f"Falha no login eWeLink (Erro {err_code}): {msg}")

    auth_data = res_data["data"]
    access_token = auth_data.get("at")
    user_info = auth_data.get("user", {})
    email_or_phone = user_info.get("email") or user_info.get("phoneNumber")

    print(f"[+] Login realizado com sucesso!")
    print(f"    Conta: {email_or_phone}")
    print(f"    Região: {region}")

    return access_token, host


def get_devices(access_token: str, host: str):
    headers = {
        "Authorization": f"Bearer {access_token}",
        "X-CK-Appid": APP_ID,
    }
    url = f"{host}/v2/device/thing?num=0"
    print(f"\n[*] Buscando dispositivos vinculados à conta...")
    res = requests.get(url, headers=headers, timeout=10)
    data = res.json()

    if data.get("error") != 0:
        raise RuntimeError(f"Erro ao buscar dispositivos: {data.get('msg')}")

    thing_list = data.get("data", {}).get("thingList", [])
    devices = []
    for item in thing_list:
        item_data = item.get("itemData", {})
        if "deviceid" in item_data:
            devices.append(item_data)

    return devices


def toggle_device(access_token: str, host: str, device_id: str, params: dict):
    headers = {
        "Authorization": f"Bearer {access_token}",
        "X-CK-Appid": APP_ID,
        "Content-Type": "application/json",
    }
    url = f"{host}/v2/device/thing/status"
    body = {
        "type": 1,
        "id": device_id,
        "params": params,
    }
    res = requests.post(url, headers=headers, json=body, timeout=10)
    return res.json()


def main():
    print("=" * 60)
    print("      DOMUS | Teste de Integração eWeLink Cloud (Sonoff)     ")
    print("=" * 60)

    # 1. Obter credenciais
    username = os.getenv("EWELINK_USERNAME")
    password = os.getenv("EWELINK_PASSWORD")
    country_code = os.getenv("EWELINK_COUNTRY_CODE", "+55")

    if len(sys.argv) >= 3:
        username = sys.argv[1]
        password = sys.argv[2]
        if len(sys.argv) >= 4:
            country_code = sys.argv[3]

    if not username:
        username = input("\nDigite seu E-mail (ou telefone) do app eWeLink: ").strip()
    if not password:
        password = input("Digite sua Senha do app eWeLink: ").strip()

    if not username or not password:
        print("[!] E-mail e senha são obrigatórios.")
        return

    try:
        token, host = login_ewelink(username, password, country_code)
        devices = get_devices(token, host)

        print(f"\n[✓] Total de dispositivos encontrados: {len(devices)}\n")
        print("-" * 60)

        indexed_devices = []
        for idx, dev in enumerate(devices, 1):
            dev_id = dev.get("deviceid", "")
            dev_name = dev.get("name", "Sem Nome")
            brand = dev.get("brandName", "eWeLink")
            online = dev.get("online", False)
            params = dev.get("params", {})
            uiid = dev.get("extra", {}).get("uiid", "N/A")

            # Identificar estado dos interruptores
            state_info = []
            if "switch" in params:
                state_info.append(f"Canal Único: {params['switch'].upper()}")
            elif "switches" in params:
                for sw in params.get("switches", []):
                    outlet = sw.get("outlet", 0) + 1
                    sw_state = sw.get("switch", "off").upper()
                    state_info.append(f"Canal {outlet}: {sw_state}")
            else:
                state_info.append(f"Params: {json.dumps(params)[:40]}...")

            online_badge = "[ONLINE]" if online else "[OFFLINE]"
            print(f"[{idx}] {dev_name} ({brand}) - ID: {dev_id} {online_badge}")
            print(f"    UIID: {uiid} | Status: {' | '.join(state_info)}")
            print("-" * 60)

            indexed_devices.append({
                "idx": idx,
                "name": dev_name,
                "id": dev_id,
                "params": params,
            })

        # Perguntar se deseja testar acionar algum
        print("\nO que deseja fazer?")
        print("1. Salvar essas credenciais no .env para integrar no sistema")
        print("2. Testar ligar/desligar um dispositivo agora")
        print("3. Sair")
        escolha = input("Escolha uma opção (1, 2 ou 3): ").strip()

        if escolha == "1":
            with open(".env", "a", encoding="utf-8") as f:
                f.write(f"\n# Credenciais eWeLink (Área de Lazer)\n")
                f.write(f"EWELINK_USERNAME={username}\n")
                f.write(f"EWELINK_PASSWORD={password}\n")
                f.write(f"EWELINK_COUNTRY_CODE={country_code}\n")
            print("[✓] Credenciais adicionadas com sucesso ao arquivo .env!")

        elif escolha == "2":
            num = input("\nDigite o número do dispositivo que deseja testar (1 a {len(devices)}): ").strip()
            if num.isdigit() and 1 <= int(num) <= len(indexed_devices):
                target = indexed_devices[int(num) - 1]
                t_params = target["params"]
                t_id = target["id"]

                # Descobrir se é single ou multi-switch
                if "switch" in t_params:
                    curr = t_params.get("switch", "off")
                    next_val = "off" if curr == "on" else "on"
                    print(f"Alternando {target['name']} para {next_val.upper()}...")
                    res = toggle_device(token, host, t_id, {"switch": next_val})
                    print("Resposta:", res)
                elif "switches" in t_params:
                    sw_list = t_params.get("switches", [])
                    c_num = input(f"Escolha o canal (1 a {len(sw_list)}): ").strip()
                    outlet_idx = int(c_num) - 1 if c_num.isdigit() and 1 <= int(c_num) <= len(sw_list) else 0
                    curr = sw_list[outlet_idx].get("switch", "off")
                    next_val = "off" if curr == "on" else "on"
                    print(f"Alternando Canal {outlet_idx + 1} de {target['name']} para {next_val.upper()}...")
                    res = toggle_device(token, host, t_id, {"switches": [{"outlet": outlet_idx, "switch": next_val}]})
                    print("Resposta:", res)

    except Exception as e:
        print(f"\n[X] Erro: {e}")


if __name__ == "__main__":
    main()
