-- ============================================================
-- Auto-flotte - Import historique emprunts (depuis Google Sheet)
-- A coller UNE FOIS dans Supabase -> SQL Editor -> Run.
-- 1) Autorise les ecritures sur emprunts (comme les autres tables) pour
--    que le bouton "Nouvel emprunt" sauvegarde et se partage entre PC.
-- 2) Importe les 28 emprunts de l historique.
-- ============================================================

ALTER TABLE emprunts DISABLE ROW LEVEL SECURITY;

INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d4-87', 'ET-095-LV', 'Nicolas', '2026-02-03', '17:40', '2026-02-05', '09:30', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d4-88', 'GP-333-QJ', 'Raph', '2026-02-05', '09:30', '2026-02-05', '15:42', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d4-89', 'GP-333-QJ', 'Léo', '2026-02-11', '16:00', '2026-02-13', '18:00', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d4-90', 'GQ-470-ZN', 'Léo', '2026-03-02', '', '2026-03-10', '12:00', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d4-91', 'FS-224-PB', 'Yannis', '2026-03-02', '', '2026-03-04', '09:35', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d4-92', 'FS-224-PB', 'Yannis', '2026-03-17', '15:00', '2026-03-18', '10:00', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d4-93', 'FR-141-MP', 'Julie', '2026-03-19', '12:00', '2026-03-24', '10:00', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d4-94', 'GQ-470-ZN', 'Raph', '2026-03-23', '16:45', '2026-03-24', '17:10', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d4-95', 'GQ-470-ZN', 'Raph', '2026-03-30', '12:20', '2026-04-01', '16:30', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d4-96', 'FR-141-MP', 'Mathéo', '2026-04-02', '11:00', '2026-04-02', '13:45', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d4-98', 'GR-019-ZG', 'Micka', '2026-04-07', '13:00', NULL, '', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d4-99', 'FR-141-MP', 'Youssouf', '2026-04-14', '10:05', NULL, '', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d4-100', 'GQ-470-ZN', 'Raph', '2026-04-15', '10:00', '2026-04-16', '10:00', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d4-101', 'ET-095-LV', 'Mathéo', '2026-04-16', '10:00', '2026-04-30', '', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d4-102', 'FR-141-MP', 'Maxime', '2026-04-20', '10:35', '2026-04-23', '11:47', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d5-103', 'GQ-470-ZN', 'Daniel', '2026-04-22', '17:30', NULL, '', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d5-104', 'GA-333-PZ', 'Enguerrand', '2026-04-29', '15:45', '2026-05-06', '', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d5-105', 'FR-141-MP', 'Youssouf', '2026-05-07', '10:30', NULL, '', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d5-106', 'FR-141-MP', 'Nicolas', '2026-05-12', '07:00', '2026-05-12', '', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d5-107', 'ET-095-LV', 'Mathéo', '2026-05-19', '10:00', '2026-05-19', '14:30', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d5-108', 'FR-141-MP', 'Daniel', '2026-05-22', '09:00', '2026-05-27', '', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d5-109', 'FS-224-PB', 'Jimmy', '2026-05-26', '07:00', NULL, '', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d5-110', 'ET-095-LV', 'Nicolas', '2026-05-26', '', NULL, '', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d5-111', 'GR-019-ZG', 'Daniel', '2026-05-27', '11:30', '2026-05-29', '17:30', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d5-112', 'GA-313-PK', 'Youssouf', '2026-05-28', '10:00', '2026-06-01', '', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d5-113', 'ET-095-LV', 'Daniel', '2026-05-29', '17:30', '2026-06-04', '15:00', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d5-114', 'ET-095-LV', 'Youssouf', '2026-06-01', '17:50', NULL, '', '');
INSERT INTO emprunts (id, vehicule, emprunteur, date_emprunt, heure_emprunt, date_retour, heure_retour, rendu_par) VALUES ('Empzro2d5-115', 'GA-313-PK', 'Shaohui', '2026-06-04', '12:30', NULL, '', '');
