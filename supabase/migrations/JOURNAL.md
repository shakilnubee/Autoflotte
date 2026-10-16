# Journal des migrations appliquées en production

Chaque migration de ce dossier est appliquée **à la main**, avec un accord explicite, sur le projet
Supabase `tzjuptlzoywjeigmyfuj`. Ce journal garde la trace de **quand**, **par qui** et **avec quel résultat**.
Tant que la Supabase CLI n'est pas en place (Phase 3), c'est la seule source fiable de « ce qui est appliqué ».

| Date (UTC) | Migration | Appliquée par | Sauvegarde préalable | Résultat vérifié |
|---|---|---|---|---|
| 2026-10-16 ~14:50 | `20261016120000_storage_fermer_acces_anonyme.sql` | Claude (accord de François et du responsable) | Sauvegarde quotidienne Supabase du 16/10 06:12 UTC + copie des 8 policies storage (`sauvegarde-policies-storage-2026-10-16.json`, transmise à François) | Policy supprimée : `"scans lecture publique"` (SELECT, rôle `public`). Restent 7 policies `{authenticated}`. `tests/securite/acces-anonyme.mjs` : ✅ aucune donnée accessible sans connexion. |
| 2026-10-16 ~14:55 | `20261016120100_vue_vehicules_public_lecture_seule.sql` | Claude (même accord) | idem (droits avant : anon et authenticated avaient SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER sur la vue) | anon et authenticated : lecture = true, ajout / modification / suppression = false. Lecture QR (`carte.html` → `vehicules_public`) : HTTP 200. |

## Retours arrière
Chaque fichier de migration contient sa procédure de retour arrière en commentaire, en bas du fichier.
