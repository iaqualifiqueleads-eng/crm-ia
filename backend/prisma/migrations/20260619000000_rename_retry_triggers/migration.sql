-- Renomeia os valores do enum TemplateTrigger: RETRY_1H→RETRY_1, RETRY_3H→RETRY_2, RETRY_24H→RETRY_3
-- MySQL não suporta ALTER TYPE, então a estratégia é:
-- 1. Adicionar coluna temporária VARCHAR
-- 2. Copiar valores mapeados
-- 3. Dropar coluna original
-- 4. Recriar com o novo ENUM
-- 5. Copiar de volta
-- 6. Dropar temporária

-- Passo 1: coluna temp
ALTER TABLE `message_templates` ADD COLUMN `trigger_new` VARCHAR(50) NOT NULL DEFAULT 'CUSTOM';

-- Passo 2: mapear valores
UPDATE `message_templates` SET `trigger_new` = CASE `trigger`
  WHEN 'RETRY_1H'  THEN 'RETRY_1'
  WHEN 'RETRY_3H'  THEN 'RETRY_2'
  WHEN 'RETRY_24H' THEN 'RETRY_3'
  ELSE `trigger`
END;

-- Passo 3: dropar coluna original
ALTER TABLE `message_templates` DROP COLUMN `trigger`;

-- Passo 4: recriar com novo ENUM
ALTER TABLE `message_templates` ADD COLUMN `trigger` ENUM('FIRST_CONTACT','REPLENISHMENT_REMINDER','REPLENISHMENT_OVERDUE','RETRY_1','RETRY_2','RETRY_3','CUSTOM','WELL_STOCKED') NOT NULL DEFAULT 'CUSTOM';

-- Passo 5: copiar valores mapeados
UPDATE `message_templates` SET `trigger` = `trigger_new`;

-- Passo 6: dropar coluna temp
ALTER TABLE `message_templates` DROP COLUMN `trigger_new`;
