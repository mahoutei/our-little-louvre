-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'PARTNER');

-- CreateEnum
CREATE TYPE "Origin" AS ENUM ('ORIGINAL', 'WING');

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "authId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PARTNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exhibit" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "anchor" TEXT,
    "origin" "Origin" NOT NULL DEFAULT 'WING',
    "title" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "dateLabel" TEXT,
    "imagePath" TEXT NOT NULL,
    "thumbPath" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "alleyIndex" INTEGER,
    "slotIndex" INTEGER,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exhibit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Letter" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'A Letter for You',
    "paragraphs" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Letter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_authId_key" ON "Member"("authId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Exhibit_slug_key" ON "Exhibit"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Exhibit_anchor_key" ON "Exhibit"("anchor");

-- CreateIndex
CREATE INDEX "Exhibit_origin_sortOrder_idx" ON "Exhibit"("origin", "sortOrder");

-- CreateIndex
CREATE INDEX "Exhibit_origin_alleyIndex_slotIndex_idx" ON "Exhibit"("origin", "alleyIndex", "slotIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Exhibit_alleyIndex_slotIndex_key" ON "Exhibit"("alleyIndex", "slotIndex");

-- CreateIndex
CREATE INDEX "Letter_active_idx" ON "Letter"("active");

-- AddForeignKey
ALTER TABLE "Exhibit" ADD CONSTRAINT "Exhibit_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
