"""
DOMUS | Teste Direto de Conexao e Acionamento eWeLink (Sonoff)
Execute no terminal:
    python test_ewelink.py
"""

import os
import sys
import time
from dotenv import load_dotenv

# Configurar encoding seguro para o terminal Windows
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

load_dotenv()

try:
    from backend.ewelink_service import ewelink_instance
except ImportError:
    from ewelink_service import ewelink_instance

DEVICES = [
    {"id": "1000e4a34e", "name": "Luz Escada", "code": "switch"},
    {"id": "1000e4bd27", "name": "Arandela Piscina", "code": "switch"},
    {"id": "1000e4a34c", "name": "Iluminacao Salao", "code": "switch"},
    {"id": "1000e8f9b1", "name": "Piscina - Cascata (CH1)", "code": "switch_1"},
    {"id": "1000e8f9b1", "name": "Piscina - Luz Subaquatica (CH2)", "code": "switch_2"},
    {"id": "1000e8f9b1", "name": "Piscina - Hidromassagem (CH3)", "code": "switch_3"},
    {"id": "1000e8f9b1", "name": "Piscina - Bomba Filtro (CH4)", "code": "switch_4"},
]

def header():
    print("=" * 65)
    print("       DOMUS | TESTE DE COMUNICACAO EWELINK / SONOFF")
    print("=" * 65)

def main():
    header()
    user = os.getenv("EWELINK_USERNAME")
    if not user:
        print("\n[ERRO] EWELINK_USERNAME nao configurado no .env!")
        return

    print(f"\n[1/3] Conectando a nuvem eWeLink com a conta: {user}...")
    t0 = time.time()
    if not ewelink_instance.login(force=True):
        print("\n[ERRO] Falha ao autenticar no eWeLink! Verifique credenciais no .env.")
        return
    print(f"[OK] Login bem-sucedido em {round(time.time() - t0, 2)}s!")
    print(f"     Regiao: {ewelink_instance.region} ({ewelink_instance.host})")

    print("\n[2/3] Buscando status de todos os aparelhos...")
    t1 = time.time()
    devices_status = ewelink_instance.fetch_devices()
    print(f"[OK] Consulta concluida em {round(time.time() - t1, 2)}s!")

    print("\n" + "-" * 65)
    print(f"{'N.':<4} {'DISPOSITIVO':<32} {'CANAL':<10} {'STATUS ATUAL'}")
    print("-" * 65)
    for idx, d in enumerate(DEVICES, start=1):
        dev_info = devices_status.get(d["id"], {})
        switches = dev_info.get("switches", {})
        is_on = switches.get(d["code"], False)
        status_txt = "[LIGADO] *" if is_on else "[DESLIGADO] ."
        print(f"[{idx}]  {d['name']:<32} {d['code']:<10} {status_txt}")
    print("-" * 65)

    print("\nOpcoes de Teste:")
    print("  [1 a 7]  Alternar (Ligar / Desligar) um dispositivo especifico")
    print("  [T]      TESTE COMPLETO: Ligar a Luz da Escada por 4 segundos e desligar")
    print("  [S]      Sair")

    try:
        choice = input("\nEscolha uma opcao: ").strip().upper()
    except (EOFError, KeyboardInterrupt):
        print("\nSaindo...")
        return

    if choice == "S":
        print("Saindo...")
        return

    if choice == "T":
        test_device = DEVICES[0]  # Luz Escada
        print(f"\n>>> TESTANDO: {test_device['name']} (ID: {test_device['id']})")
        print("1. Ligando agora...")
        ok = ewelink_instance.set_switch(test_device["id"], test_device["code"], True)
        if ok:
            print("   -> SUCESSO: Comando de LIGAR aceito pela nuvem eWeLink!")
            print("   -> (Olhe para a luz da escada, ela deve ter acendido!)")
        else:
            print("   -> Falha ao enviar comando de ligar!")

        print("\nAguardando 4 segundos...")
        time.sleep(4)

        print("2. Desligando agora...")
        ok = ewelink_instance.set_switch(test_device["id"], test_device["code"], False)
        if ok:
            print("   -> SUCESSO: Comando de DESLIGAR aceito pela nuvem eWeLink!")
            print("   -> (A luz deve ter apagado!)")
        else:
            print("   -> Falha ao enviar comando de desligar!")

        print("\nTeste concluido com sucesso!")
        return

    if choice.isdigit() and 1 <= int(choice) <= len(DEVICES):
        idx = int(choice) - 1
        target = DEVICES[idx]
        dev_info = devices_status.get(target["id"], {})
        current_state = dev_info.get("switches", {}).get(target["code"], False)
        new_state = not current_state

        action_txt = "LIGAR" if new_state else "DESLIGAR"
        print(f"\nEnviando comando para {action_txt} '{target['name']}'...")
        t_cmd = time.time()
        ok = ewelink_instance.set_switch(target["id"], target["code"], new_state)
        elapsed = round(time.time() - t_cmd, 2)

        if ok:
            novo_status = "[LIGADO]" if new_state else "[DESLIGADO]"
            print(f"[SUCESSO] {target['name']} alterado para {novo_status} em {elapsed}s!")
        else:
            print(f"[FALHA] Nuvem eWeLink recusou comando para {target['name']}.")
    else:
        print("Opcao invalida.")

if __name__ == "__main__":
    main()
