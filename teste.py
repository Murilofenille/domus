from tuya_connector import TuyaOpenAPI

ACCESS_ID = "cw8xfypa89ykskhtmu4q"
ACCESS_SECRET = "67d91e7bf68640bd9fa742affa83b941"
API_ENDPOINT = "https://openapi.tuyaus.com"

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