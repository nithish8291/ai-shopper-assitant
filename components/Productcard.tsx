"use client";

import { useState } from "react";

export interface ProductSkuDTO {
  skuId?: string;
  price?: number;
  available?: boolean;
  seller?: string;
  referenceId: string;
  imageUrl?: string;
  name?: string;
}

export interface ProductDTO {
  productId: string;
  productName: string;
  brand?: string;
  category?: string;
  linkText?: string;
  description?: string;
  FAQ?: string;
  defaultSku: ProductSkuDTO[];
  skuOptions: ProductSkuDTO[];
}

interface ProductCardProps {
  product: ProductDTO;
  onAddToCart?: (skuId: string) => void;
  onViewDetails?: (skuId: string) => void;
}

export default function ProductCard({ product, onAddToCart, onViewDetails }: ProductCardProps) {
  const defaultSku = product.defaultSku?.[0];
  const [selectedSkuId, setSelectedSkuId] = useState<string | undefined>(defaultSku?.skuId);

  const selectedSku =
    product.skuOptions?.find((s) => s.skuId === selectedSkuId) ||
    product.defaultSku?.find((s) => s.skuId === selectedSkuId) ||
    defaultSku;

  const displayImage = selectedSku?.imageUrl || defaultSku?.imageUrl;
  const displayPrice = selectedSku?.price ?? defaultSku?.price;
  const displayName = product.productName;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800">
      {displayImage && (
        <img
          src={displayImage}
          alt={displayName}
          className="w-full h-40 object-cover rounded-lg mb-3"
        />
      )}

      <h4 className="font-semibold text-sm line-clamp-2 mb-1">{displayName}</h4>

      {product.brand && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{product.brand}</p>
      )}

      {displayPrice != null && (
        <p className="text-lg font-bold text-blue-600 mb-3">
          ${displayPrice.toFixed(2)}
        </p>
      )}

      {/* SKU Options */}
      {product.skuOptions && product.skuOptions.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Options:</p>
          <div className="flex flex-wrap gap-1.5">
            {product.skuOptions.map((sku) => {
              const isDefault = product.defaultSku?.some((d) => d.skuId === sku.skuId);
              const isSelected = sku.skuId === selectedSkuId;
              return (
                <button
                  key={sku.skuId || sku.referenceId}
                  onClick={() => setSelectedSkuId(sku.skuId)}
                  className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                    isSelected
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                      : isDefault
                      ? "border-blue-300 bg-blue-50/50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400"
                      : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                  } ${!sku.available ? "opacity-50 line-through" : ""}`}
                  disabled={!sku.available}
                  title={sku.available ? sku.name : `${sku.name} (unavailable)`}
                >
                  {sku.name || sku.referenceId}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {onViewDetails && selectedSkuId && (
          <button
            onClick={() => onViewDetails(selectedSkuId)}
            className="flex-1 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Details
          </button>
        )}
        {onAddToCart && selectedSkuId && (
          <button
            onClick={() => onAddToCart(selectedSkuId)}
            className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add to Cart
          </button>
        )}
      </div>
    </div>
  );
}