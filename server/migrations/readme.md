# Migrations

## Base de dados nova, do zero

Corre só este ficheiro, e tens o sistema completamente funcional:

```
psql "A_TUA_CONNECTION_STRING" -f server/migrations/001_initial_schema.sql
```

(ou usa o SQL Editor do Neon, colando o conteúdo do ficheiro)

Testado localmente antes de entrar aqui — cria as 14 tabelas sem erros, e é seguro
correr mais do que uma vez sem partir nada (usa `IF NOT EXISTS` em tudo).

## A partir de agora

Qualquer alteração nova à base de dados (nova coluna, nova tabela, etc.) deve
ficar guardada aqui, num ficheiro numerado a seguir ao último:

```
server/migrations/002_o-que-for.sql
server/migrations/003_o-que-for.sql
```

Isto substitui o hábito antigo de correr SQL avulso só no Neon sem o guardar em
lado nenhum — a partir de agora, se algum dia precisares de recriar a base de
dados do zero (ex: um ambiente novo, um teste, uma migração de fornecedor), só
precisas de correr os ficheiros desta pasta, por ordem.