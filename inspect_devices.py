import json
from backend.server import openapi

devices = [
    ('Cozinha', 'eb0253512b47c620f1b3tg'),
    ('Quarto Marina', '0076231634ab9510916c'),
    ('Led Guarda Roupa', 'eb3a48b14417d7cd46g13x'),
    ('Interruptor Escritório Murilo', 'eba0bc9062cb902519bv8a'),
    ('Banheiro Social', 'ebea951fa1e1900c21l4op'),
    ('Closet', '0076231634ab951d1684'),
    ('Lavanderia', 'eb06af9cdbe3a70513uvmv'),
    ('Interruptor Sala', 'eb4363d2fae69d1b3ak5lg'),
    ('Corredor Suíte', 'eb7ec51b1a94acaf7ffjqx'),
    ('Quarto Murilo', '7173100234ab95105538'),
    ('Corredor Principal', '7753207334ab951d4101'),
    ('Quarto Alfeo', '0076231634ab9510ba04'),
    ('Suíte Master', 'eb7b83c1dcb03d24231db5'),
    ('Banheiro Master', 'eb359369a7c7cd5cacz5cb'),
    ('Corredor Claraboia', 'ebbfb1b732983a19det4ng'),
    ('Banheiro Alfeo', 'eb4bb2c6b85ca80c08xen2')
]

results = {}
for name, dev_id in devices:
    res = openapi.get(f"/v1.0/devices/{dev_id}/status")
    if res.get('success'):
        status_list = res.get('result', [])
        dps = {item['code']: item['value'] for item in status_list}
        results[name] = {"device_id": dev_id, "online": True, "dps": dps}
        print(f"[ONLINE] {name}: {list(dps.keys())}")
    else:
        results[name] = {"device_id": dev_id, "online": False, "msg": res.get("msg")}
        print(f"[OFFLINE] {name}: {res.get('msg')}")

with open("devices_map.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
