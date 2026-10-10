-- CreateTable
CREATE TABLE "MemberShip" (
    "mid" INTEGER NOT NULL,
    "mname" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "MemberShip_pkey" PRIMARY KEY ("mid")
);

-- CreateTable
CREATE TABLE "Customer" (
    "uid" INTEGER NOT NULL,
    "fullname" TEXT NOT NULL,
    "mid" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("uid")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberShip_mname_key" ON "MemberShip"("mname");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_mid_fkey" FOREIGN KEY ("mid") REFERENCES "MemberShip"("mid") ON DELETE RESTRICT ON UPDATE CASCADE;
