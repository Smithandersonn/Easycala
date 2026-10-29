# Planejamento de Escala — manutenção

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


## Ajustes recentes

- O título visível foi alterado para **Planejamento de Escala**, sem o nome Kalunga.
- O seletor **Tem escala de domingo?** permite ativar ou ocultar o painel de revezamento de domingos. A escolha fica salva no navegador.
- A coluna **Última folga anterior**, antes dos dias do mês, permite informar para cada colaborador a data da última folga do mês anterior. Essa data é considerada como descanso ao calcular sequências de trabalho e avisos do regime 5x2/6x1.
- Os avisos de descanso agora usam verde-azulado suave, alinhado à cor das folgas e ao restante da interface.
- A data de última folga deve ser escolhida no mês anterior ao mês exibido.


## Módulo de lançamento de itens

- O menu superior alterna entre a escala e o controle de itens.
- O saldo e o histórico dos lançamentos são salvos no navegador usando a chave `planejamento-escala-inventory-v1`, separada dos dados da escala.
- Cada envio registra código, quantidade, saldo anterior, saldo atualizado e data/hora. Códigos são normalizados para maiúsculas, evitando duplicatas por diferença de caixa.
- `Exportar lista (CSV)` e `Imprimir lista` mostram apenas o código de cada item e sua quantidade acumulada. O histórico detalhado continua disponível na auditoria dos últimos 3 lançamentos na tela.
- Os dados ficam locais neste navegador/dispositivo; exporte o CSV para guardar uma cópia ou consultar em outro computador.
- Quando um dia tiver o aviso de descanso necessário, a célula mostra somente o sinal `!` em vez de combinar o `T` de Trabalha com o alerta, evitando deformação do botão.


## Lançamento rápido de itens (atualização)
- A auditoria visível abaixo do formulário mostra somente os 3 lançamentos mais recentes; exportação CSV e impressão trazem apenas a lista de códigos com as quantidades acumuladas.
- Após lançar, código e quantidade são limpos e o foco retorna ao campo de código. Quantidade começa vazia. Use Tab para ir à quantidade e Enter para confirmar. Enter no campo de código move o foco para quantidade.
- São aceitos somente códigos internos numéricos de exatamente 6 dígitos ou códigos de barras numéricos GTIN/EAN/UPC de 8, 12, 13 ou 14 dígitos com dígito verificador válido. Outros formatos são rejeitados.
- A confirmação ao lado do formulário informa se o código é novo ou se o saldo foi somado, com quantidade, saldo acumulado e horário.

## Editar ou excluir itens
Na tabela de saldo atual, use **Editar** para alterar a quantidade total ou **Excluir** para remover o código da lista. As duas ações pedem confirmação. O histórico de auditoria não é apagado; ele registra os ajustes e as exclusões.

## Uso sem internet
O site agora inclui `service-worker.js` e `manifest.webmanifest`. Publique via HTTPS no Netlify e abra o endereço com internet pelo menos uma vez para que os arquivos sejam armazenados em cache. Depois disso, o app pode abrir sem conexão no mesmo navegador/dispositivo. Os dados continuam em `localStorage` daquele navegador; limpar os dados do site, trocar de navegador/dispositivo ou perder o aparelho pode apagar o acesso aos dados. Exporte a lista e mantenha backups regulares. O modo offline não sincroniza dados entre dispositivos.


## Escala de feriados do mês

Na barra superior da escala existem dois controles independentes: ativar/desativar o revezamento de domingos e ativar/desativar o lançamento da escala de feriados. Ao ativar feriados, o sistema cria um cartão para cada feriado nacional identificado no mês selecionado. Em cada cartão, marque os colaboradores que trabalharão naquela data. A seleção é salva no navegador. O botão **Aplicar escala de feriados** pede confirmação e registra `trabalha` para os selecionados e `folga` para os demais, em cada feriado do mês. Feriados estaduais e municipais não são detectados automaticamente por não dependerem de uma localidade configurada.

### Ajustes da escala de feriados
- Cada feriado do mês aparece em cartões lado a lado quando há espaço na tela; em telas estreitas, os cartões empilham automaticamente.
- Todos os colaboradores começam desmarcados, inclusive quando não existe seleção salva para aquele feriado. Ao aplicar, os desmarcados recebem `folga` e os marcados recebem `trabalha`.
- O painel “Último feriado com escala registrada” procura o feriado nacional passado mais recente com marcações explícitas salvas e lista os colaboradores registrados como trabalhando.
- Para atualizar o cache offline, a versão do service worker foi incrementada.
