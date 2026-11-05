# Consultas de Auditoria de Banco de Dados — Somente Leitura

Conjunto de scripts SQL estritamente `SELECT` para inspeção e governança de dados no Supabase.

| Arquivo | Finalidade | Quando Usar |
| :--- | :--- | :--- |
| `01_allergen_and_quality_defaults.sql` | Identifica produtos com afirmações automáticas genéricas de alergênicos ou qualidade. | Revisão obrigatória com o Responsável Técnico (RT). |
| `02_escaped_entities_corruption.sql` | Mapeia registros que sofreram escape duplo (`&amp;amp;`, `&amp;lt;`). | Antes e após rodar `scripts/repair-escapes.mjs`. |
| `03_incomplete_active_products.sql` | Detecta produtos ativos sem categoria, imagem ou com preço zerado. | Monitoramento de catálogo da loja. |
| `04_orphan_storage_candidates.sql` | Lista arquivos no bucket `product-images` sem vínculo no banco. | Manutenção preventiva de armazenamento. |

## Como Executar
1. Acesse o painel do Supabase do seu projeto.
2. No menu lateral esquerdo, clique em **SQL Editor**.
3. Abra ou cole o conteúdo do script desejado e clique em **Run**.
4. Nenhum destes scripts realiza `INSERT`, `UPDATE` ou `DELETE`.
