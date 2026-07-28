-- ============================================================
-- Renseigne la boîte de vitesses (Automatique / Manuelle) de la flotte.
-- Déterminé par motorisation + version + contrats leasing BPCE
-- (la carte grise ne contient PAS le type de boîte).
-- À exécuter dans Supabase → SQL Editor, APRÈS add-couleur-boite.sql.
-- Idempotent : ré-exécutable sans risque.
-- ============================================================
alter table public.vehicules add column if not exists boite text;

-- AUTOMATIQUE — certain : électriques, hybrides, et boîtes auto explicites
-- (EAT8 / DCT / S-tronic / BVA6), + Trafic « DCI 150 AUTO » (confirmé par le contrat).
update public.vehicules set boite = 'Automatique' where immat in (
  -- électriques
  'GC-885-LB','GT-565-XR','GD-056-CR','GE-349-FZ','HG-763-VP','GR-745-LR',
  'GT-818-LC','GY-719-JY','GY-720-JY','D XP 300','JPV-51-S',
  -- hybrides (toujours automatiques)
  'FF-304-GL','FF-777-XK','HE-739-WP','HJ-285-FL','HJ-181-RN','HG-709-CH',
  'HF-749-VD','HH-613-KE','GY-860-FG','HH-464-LQ','HB-844-DE','HB-733-DE',
  'GA-333-PZ','HH-458-LQ','HF-477-XW',
  -- boîte auto explicite dans la version (EAT8 / DCT)
  'GP-795-YL','GW-075-EZ','GW-087-EZ','GW-173-JV','FJ-607-QH','GP-232-WF',
  'GM-548-QA','FS-224-PB','FT-338-AJ',
  -- Trafic automatique (contrat leasing)
  'HJ-804-VM'
);

-- MANUELLE — bonne confiance (Dacia Duster TCe, Renault Kadjar essence, fourgons diesel).
-- ⚠️ Vérifie si tu as un doute sur l'un d'eux (surtout les Kadjar).
update public.vehicules set boite = 'Manuelle' where immat in (
  'GR-585-HP','GR-302-HP','GR-019-ZG','GR-467-HP','GQ-470-ZN',   -- Dacia Duster
  'GH-994-AR','GE-948-WY','FZ-501-YZ',                           -- Renault Kadjar
  'FR-141-MP','ET-095-LV','ED-160-TZ'                            -- Vivaro / Jumpy / Trafic diesel
);

-- NON RENSEIGNÉS (à confirmer toi-même dans la fiche véhicule) :
--   GA-313-PK  Iveco 35C18        → manuelle OU Hi-Matic auto ?
--   FZ-301-YZ  Peugeot 5008 130   → BVM6 (manuelle) OU EAT8 (auto) ? pas de marqueur
--   GP-333-QJ  Peugeot 5008       → version non renseignée
--   GZ-103-JN  Ducati (moto)      → boîte séquentielle (non concerné)
--   6677880    Toyota Fenwick     → chariot élévateur (non concerné)
