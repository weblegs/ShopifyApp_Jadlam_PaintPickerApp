-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMeta" (
    "id" SERIAL NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_title" TEXT NOT NULL,
    "metafield_name" TEXT NOT NULL,
    "metafield_value" TEXT NOT NULL,
    "colourgroup" TEXT NOT NULL DEFAULT '',
    "shop" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HexCodeProduct" (
    "id" SERIAL NOT NULL,
    "product_id" TEXT NOT NULL,
    "hex_color" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,
    "shop" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HexCodeProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchProduct" (
    "id" SERIAL NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_title" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL DEFAULT '',
    "sku" TEXT NOT NULL DEFAULT '',
    "price" TEXT NOT NULL DEFAULT '',
    "compare_at_price" TEXT NOT NULL DEFAULT '',
    "inventory_quantity" INTEGER NOT NULL DEFAULT 0,
    "vendor" TEXT NOT NULL DEFAULT '',
    "handle" TEXT NOT NULL DEFAULT '',
    "paint_hexa_code" TEXT NOT NULL DEFAULT '',
    "paint_colour" TEXT NOT NULL DEFAULT '',
    "paint_type" TEXT NOT NULL DEFAULT '',
    "paint_container" TEXT NOT NULL DEFAULT '',
    "paint_number" TEXT NOT NULL DEFAULT '',
    "paint_range" TEXT NOT NULL DEFAULT '',
    "shop" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductMeta_product_id_shop_key" ON "ProductMeta"("product_id", "shop");

-- CreateIndex
CREATE UNIQUE INDEX "HexCodeProduct_product_id_shop_key" ON "HexCodeProduct"("product_id", "shop");

-- CreateIndex
CREATE UNIQUE INDEX "SearchProduct_product_id_shop_key" ON "SearchProduct"("product_id", "shop");
