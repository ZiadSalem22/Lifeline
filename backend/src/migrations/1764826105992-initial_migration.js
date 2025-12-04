/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 * @typedef {import('typeorm').QueryRunner} QueryRunner
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class InitialMigration1764826105992 {
    name = 'InitialMigration1764826105992'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "user_settings" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_00f004f5922a0744d174530d639" DEFAULT NEWSEQUENTIALID(), "user_id" nvarchar(64) NOT NULL, "theme" nvarchar(32), "locale" nvarchar(10), "layout" nvarchar(max), "created_at" datetime NOT NULL CONSTRAINT "DF_0d253ce8f3da839c8a8863847e5" DEFAULT GETDATE(), "updated_at" datetime NOT NULL CONSTRAINT "DF_8c6f52c7074bec4bb38d92ea525" DEFAULT GETDATE(), CONSTRAINT "PK_00f004f5922a0744d174530d639" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_profiles" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_1ec6662219f4605723f1e41b6cb" DEFAULT NEWSEQUENTIALID(), "user_id" nvarchar(64) NOT NULL, "first_name" nvarchar(100), "last_name" nvarchar(100), "phone" nvarchar(32), "country" nvarchar(64), "city" nvarchar(64), "timezone" nvarchar(64), "avatar_url" nvarchar(255), "onboarding_completed" bit NOT NULL CONSTRAINT "DF_7f0a9be275ee9be1f54aef4964c" DEFAULT 0, "created_at" datetime NOT NULL CONSTRAINT "DF_09682a1c7fc4702bced05136ad0" DEFAULT GETDATE(), "updated_at" datetime NOT NULL CONSTRAINT "DF_6152765ab87dce7a3784da40f20" DEFAULT GETDATE(), CONSTRAINT "PK_1ec6662219f4605723f1e41b6cb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "REL_6ca9503d77ae39b4b5a6cc3ba8" ON "user_profiles" ("user_id") WHERE "user_id" IS NOT NULL`);
        await queryRunner.query(`CREATE TABLE "users" ("id" nvarchar(64) NOT NULL, "email" nvarchar(255) NOT NULL, "name" nvarchar(255), "picture" nvarchar(512), "created_at" datetime NOT NULL CONSTRAINT "DF_c9b5b525a96ddc2c5647d7f7fa5" DEFAULT GETDATE(), "updated_at" datetime NOT NULL CONSTRAINT "DF_6d596d799f9cb9dac6f7bf7c23c" DEFAULT GETDATE(), "role" nvarchar(32), "subscription_status" nvarchar(32) NOT NULL CONSTRAINT "DF_819b17e2c9f594d16ec29b25839" DEFAULT 'none', CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "todo_tags" ("todo_id" varchar(255) NOT NULL, "tag_id" varchar(255) NOT NULL, CONSTRAINT "PK_e9221a8ac3b2a7411a60500a638" PRIMARY KEY ("todo_id", "tag_id"))`);
        await queryRunner.query(`CREATE TABLE "todos" ("id" varchar(64) NOT NULL, "title" nvarchar(200) NOT NULL, "description" nvarchar(2000), "due_date" datetime, "is_completed" int NOT NULL CONSTRAINT "DF_ad2c5b4967dd89e27c96945c41c" DEFAULT 0, "is_flagged" int NOT NULL CONSTRAINT "DF_66bea936161c148657f34aed3f5" DEFAULT 0, "duration" int NOT NULL CONSTRAINT "DF_49055f6e0c4f2cbb0bd2500ab71" DEFAULT 0, "priority" nvarchar(16) NOT NULL CONSTRAINT "DF_ff8ff02cfdf0c6a08561bf3f407" DEFAULT 'medium', "due_time" nvarchar(16), "subtasks" nvarchar(MAX) NOT NULL CONSTRAINT "DF_3a0952b6fc0d77333e4e46de5a3" DEFAULT '[]', "order" int NOT NULL CONSTRAINT "DF_1a372408943e8a1a4e42912ed4b" DEFAULT 0, "recurrence" nvarchar(MAX), "next_recurrence_due" datetime, "original_id" nvarchar(64), "archived" int NOT NULL CONSTRAINT "DF_b223a97ece6bbdae79e25a1dab3" DEFAULT 0, "user_id" nvarchar(128) NOT NULL, CONSTRAINT "PK_ca8cafd59ca6faaf67995344225" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tags" ("id" varchar(255) NOT NULL, "name" nvarchar(255) NOT NULL, "color" nvarchar(255) NOT NULL, "user_id" nvarchar(128), "is_default" int NOT NULL CONSTRAINT "DF_7638809978a93e5d5a002b287f6" DEFAULT 0, CONSTRAINT "PK_e7dc17249a1148a1970748eda99" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "todo_tags" DROP CONSTRAINT "PK_e9221a8ac3b2a7411a60500a638"`);
        await queryRunner.query(`ALTER TABLE "todo_tags" ADD CONSTRAINT "PK_425e9a5498a6e434e3c6335b289" PRIMARY KEY ("tag_id")`);
        await queryRunner.query(`ALTER TABLE "todo_tags" DROP COLUMN "todo_id"`);
        await queryRunner.query(`ALTER TABLE "todo_tags" ADD "todo_id" varchar(64) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "todo_tags" DROP CONSTRAINT "PK_425e9a5498a6e434e3c6335b289"`);
        await queryRunner.query(`ALTER TABLE "todo_tags" ADD CONSTRAINT "PK_e9221a8ac3b2a7411a60500a638" PRIMARY KEY ("tag_id", "todo_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_995af982f546b93672fe0ae652" ON "todo_tags" ("todo_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_425e9a5498a6e434e3c6335b28" ON "todo_tags" ("tag_id") `);
        await queryRunner.query(`ALTER TABLE "user_profiles" ADD CONSTRAINT "FK_6ca9503d77ae39b4b5a6cc3ba88" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "todo_tags" ADD CONSTRAINT "FK_995af982f546b93672fe0ae6525" FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "todo_tags" ADD CONSTRAINT "FK_425e9a5498a6e434e3c6335b289" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "todo_tags" DROP CONSTRAINT "FK_425e9a5498a6e434e3c6335b289"`);
        await queryRunner.query(`ALTER TABLE "todo_tags" DROP CONSTRAINT "FK_995af982f546b93672fe0ae6525"`);
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP CONSTRAINT "FK_6ca9503d77ae39b4b5a6cc3ba88"`);
        await queryRunner.query(`DROP INDEX "IDX_425e9a5498a6e434e3c6335b28" ON "todo_tags"`);
        await queryRunner.query(`DROP INDEX "IDX_995af982f546b93672fe0ae652" ON "todo_tags"`);
        await queryRunner.query(`ALTER TABLE "todo_tags" DROP CONSTRAINT "PK_e9221a8ac3b2a7411a60500a638"`);
        await queryRunner.query(`ALTER TABLE "todo_tags" ADD CONSTRAINT "PK_425e9a5498a6e434e3c6335b289" PRIMARY KEY ("tag_id")`);
        await queryRunner.query(`ALTER TABLE "todo_tags" DROP COLUMN "todo_id"`);
        await queryRunner.query(`ALTER TABLE "todo_tags" ADD "todo_id" varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "todo_tags" DROP CONSTRAINT "PK_425e9a5498a6e434e3c6335b289"`);
        await queryRunner.query(`ALTER TABLE "todo_tags" ADD CONSTRAINT "PK_e9221a8ac3b2a7411a60500a638" PRIMARY KEY ("todo_id", "tag_id")`);
        await queryRunner.query(`DROP TABLE "tags"`);
        await queryRunner.query(`DROP TABLE "todos"`);
        await queryRunner.query(`DROP TABLE "todo_tags"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "REL_6ca9503d77ae39b4b5a6cc3ba8" ON "user_profiles"`);
        await queryRunner.query(`DROP TABLE "user_profiles"`);
        await queryRunner.query(`DROP TABLE "user_settings"`);
    }
}
