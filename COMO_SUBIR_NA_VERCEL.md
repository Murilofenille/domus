# 🚀 Como Publicar na Vercel (100% Grátis & Sem Computador Ligado)

O projeto já está **100% configurado** para rodar em modo **Serverless Tudo-em-Um na Vercel**!

Você não precisa manter seu computador ligado e não precisa pagar nenhum plano (custo R$ 0,00).

---

## 📋 Passo a Passo para Publicar

### 1. Subir seu projeto no GitHub
Se ainda não subiu para o GitHub:
1. Crie um repositório no seu GitHub (pode ser Privado).
2. No terminal do projeto, envie os arquivos:
   ```bash
   git init
   git add .
   git commit -m "Central Tuya Domus 3D Serverless"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```

---

### 2. Importar o projeto na Vercel
1. Acesse [vercel.com](https://vercel.com) e faça login com sua conta do GitHub.
2. Clique no botão **"Add New..."** ➔ **"Project"**.
3. Localize seu repositório da Tuya e clique em **"Import"**.
4. A Vercel vai detectar automaticamente o arquivo `vercel.json` e o `package.json` da raiz.
   - **Root Directory:** Deixe `./` (padrão).
   - **Build Command:** Já vem pré-configurado pelo `vercel.json`.
   - **Output Directory:** Já vem pré-configurado (`frontend/dist`).

---

### 3. Configurar as Variáveis de Ambiente (Environment Variables)
Na tela da Vercel (ou em **Settings ➔ Environment Variables**), adicione as chaves do seu `.env`:

| Nome da Variável | Valor |
| :--- | :--- |
| `TUYA_ACCESS_ID` | *Seu Access ID da Tuya Cloud* |
| `TUYA_ACCESS_SECRET` | *Seu Access Secret da Tuya Cloud* |
| `TUYA_API_ENDPOINT` | `https://openapi.tuyaus.com` |
| `EWELINK_USERNAME` | *Seu e-mail da conta Sonoff/eWeLink* |
| `EWELINK_PASSWORD` | *Sua senha da conta Sonoff/eWeLink* |
| `EWELINK_COUNTRY_CODE` | `+55` |

*(Nota: O código já possui fallback embutido, mas adicionar na Vercel garante que caso você troque de senha, basta atualizar lá)*

---

### 4. Clicar em "Deploy"
1. Clique em **"Deploy"**.
2. A Vercel vai instalar o Python e o Node, compilar o frontend 3D e publicar a API Serverless.
3. Em menos de 2 minutos você terá uma URL com SSL ativo, por exemplo:
   👉 **`https://tuya-controlador.vercel.app`**

---

### 5. Pronto!
- Você pode abrir esse link no seu celular, tablet ou qualquer navegador.
- Os interruptores, status da casa e o gerenciador de cômodos funcionarão direto na nuvem.
- Suas personalizações de nomes de canais e cômodos ficam gravadas com segurança e redundância no seu próprio navegador (`localStorage`).
