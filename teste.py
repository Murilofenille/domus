import os
from dotenv import load_dotenv
from tuya_connector import TuyaOpenAPI

load_dotenv()

ACCESS_ID = os.getenv("TUYA_ACCESS_ID", "")
ACCESS_SECRET = os.getenv("TUYA_ACCESS_SECRET", "")
API_ENDPOINT = os.getenv("TUYA_API_ENDPOINT", "https://openapi.tuyaus.com")

DEVICE_ID = "7173100234ab95105538"

openapi = TuyaOpenAPI(API_ENDPOINT, ACCESS_ID, ACCESS_SECRET)

# Login/autenticação
response = openapi.connect()
print("Conexão:", response)

# Consultar estado do interruptor
response = openapi.get(f"/v1.0/devices/{DEVICE_ID}/status")

print("\nEstado do dispositivo:")
print(response)

# Ligar o switch 1
command = {
    "commands": [
        {
            "code": "switch_1",
            "value": False
        }
    ]
}

response = openapi.post(
    f"/v1.0/devices/{DEVICE_ID}/commands",
    command
)

print("\nComando enviado:")
print(response)