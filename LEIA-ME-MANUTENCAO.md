# Escala Kalunga — manutenção

## Verificação de cobertura da equipe

A verificação de cobertura considera somente o total de colaboradores marcados como **Folga em cada dia**, sem aplicar regras diferentes por cargo.

- O alerta aparece quando há pelo menos 3 pessoas de folga e elas representam pelo menos 30% da equipe cadastrada.
- O sistema sugere até 3 mudanças, priorizando datas úteis sem feriado e com menos pessoas já de folga.
- As sugestões são informativas: nenhuma marcação é alterada automaticamente.
- Não há alertas específicos por cargo na verificação de cobertura.

## Publicação

Substitua `index.html`, `styles.css` e `script.js` no repositório GitHub e faça o commit. Depois, atualize o site com `Ctrl + F5`.


### Verificação geral de folgas
A análise de concentração de folgas ignora domingos e feriados nacionais, pois a loja trabalha com equipe reduzida nesses dias. As sugestões de transferência também não indicam domingos nem feriados; sábados podem ser sugeridos quando forem dias de trabalho e a pessoa estiver marcada como trabalhando. Não há regras de cobertura específicas por cargo.
