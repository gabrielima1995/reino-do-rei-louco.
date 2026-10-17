# Reino do Rei Louco

Jogo cooperativo online estilo Realm of the Mad God. Quem abrir o endereço entra no mesmo mapa, sem precisar de conta.

## Rodar no seu computador

1. Instale o Node.js (https://nodejs.org, versão 18 ou mais nova).
2. Nesta pasta, rode:

       node server.js

3. Abra http://localhost:3000. Para o amigo entrar pela internet a partir do seu PC, use um túnel como o ngrok (`ngrok http 3000`) e mande o endereço que ele gerar.

## Hospedar de graça no Render (recomendado para jogar online)

1. Crie uma conta em https://render.com e também em https://github.com.
2. Crie um repositório no GitHub e envie esta pasta (server.js, package.json, public/).
3. No Render: New → Web Service → conecte o repositório.
   - Runtime: Node
   - Build command: (deixe vazio)
   - Start command: `node server.js`
   - Instance type: Free
4. Ao terminar, o Render mostra um endereço `https://seu-jogo.onrender.com`. Mande esse link para o amigo.

No plano gratuito o servidor dorme após 15 minutos sem uso; o primeiro acesso demora até 1 minuto para acordar, depois fica normal.
