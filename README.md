# Meu Caixa

PWA local-first para registrar entradas e saidas em formato de conversa.

## Privacidade

Os lancamentos ficam somente no armazenamento local do navegador do aparelho, usando IndexedDB. O app nao tem backend e nao envia dados financeiros para servidor.

## Dados do lancamento

- `tipo`: entrada ou saida
- `valor`: valor do lancamento ou de cada parcela
- `nota`: descricao do gasto ou entrada
- `dataOperacao`: data em que a operacao aconteceu
- `dataCriacao`: data em que a pessoa registrou no app
- `parcelasTotal`, `parcelaNumero`, `grupoParcelamentoId`
- `valorTotalParcelado`
- `textoOriginal`

## Fluxo principal

- Home com saldo do mes e tres botoes: Lancar, Relatorio e Alterar
- Lancar salva automaticamente a frase entendida pelo app
- A resposta do chat mostra um botao Alterar para corrigir o lancamento
- Alterar lista todos os lancamentos por data e permite editar tipo, valor, data e nota
- Relatorio filtra por data e tipo e exporta PDF

## Rodar local

```powershell
cd C:\Apps\meu-caixa
python -m http.server 5173
```

Depois abra `http://localhost:5173`.

## Vercel

Este projeto e estatico. Na Vercel, publique a raiz do repositorio sem comando de build.
