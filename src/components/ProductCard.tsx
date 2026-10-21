import React, { useState } from 'react'
import { Package, Minus, Plus, ShoppingCart } from 'lucide-react'
import type { Produto, TabelaPreco } from '../types'

interface ProductCardProps {
  produto: Produto
  tabelas: TabelaPreco[]
  tabelaAtivaId?: string
  onAddToCart: (produto: Produto, quantidade: number, tabelaId?: string) => void
}

export const ProductCard: React.FC<ProductCardProps> = ({
  produto,
  tabelas,
  tabelaAtivaId,
  onAddToCart,
}) => {
  const [qty, setQty] = useState<number>(1)
  const [selectedTabela, setSelectedTabela] = useState<string>(tabelaAtivaId || '')

  // Preço calculado de acordo com a tabela selecionada
  const precoBase = Number(produto.preco_tabela) || 0
  const tabela = tabelas.find((t) => t.id === selectedTabela)
  let precoEfetivo = precoBase
  if (tabela) {
    if (tabela.tipo_ajuste === 'acrescimo_pct') {
      precoEfetivo = precoBase * (1 + tabela.percentual_ajuste / 100)
    } else if (tabela.tipo_ajuste === 'desconto_pct') {
      precoEfetivo = precoBase * (1 - tabela.percentual_ajuste / 100)
    }
  }

  const precoFmt = precoEfetivo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const subtotalLinha = (precoEfetivo * qty).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const handleDec = () => {
    setQty((prev) => Math.max(1, prev - 1))
  }

  const handleInc = () => {
    setQty((prev) => prev + 1)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10)
    if (!isNaN(val) && val >= 1) {
      setQty(val)
    } else if (e.target.value === '') {
      setQty(1)
    }
  }

  const handleAdd = () => {
    onAddToCart(produto, qty, selectedTabela || undefined)
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-teal-300">
      {/* Imagem do Produto */}
      <div className="relative aspect-square overflow-hidden bg-slate-50 p-3">
        <div className="absolute inset-0 flex items-center justify-center text-slate-300">
          <Package className="h-12 w-12" />
        </div>
        {produto.imagem_url ? (
          <img
            src={produto.imagem_url}
            alt={produto.nome}
            loading="lazy"
            className="relative h-full w-full object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : null}

        {/* Badges superiores */}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-slate-900/85 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
          #{produto.codigo}
        </span>
        {produto.estoque_atual > 0 ? (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200 shadow-sm">
            {produto.estoque_atual} {produto.unidade}
          </span>
        ) : (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200 shadow-sm">
            Sem estoque
          </span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex flex-1 flex-col border-t border-slate-100 p-3 sm:p-3.5">
        <h2 className="line-clamp-2 min-h-[2.5rem] text-xs sm:text-[13px] font-bold leading-snug text-slate-900">
          {produto.nome}
        </h2>

        <div className="mt-1 flex items-center justify-between gap-1 text-[11px] text-slate-500">
          <span className="truncate">{produto.categoria_nome || produto.unidade}</span>
          <span className="font-semibold text-slate-400">{produto.unidade}</span>
        </div>

        {/* Preço em Destaque */}
        <div className="mt-2">
          <p className="text-base sm:text-lg font-black tracking-tight text-teal-800">
            {precoBase > 0 ? precoFmt : 'Sob consulta'}
          </p>
        </div>

        {/* Seletor de Tabela de Preço (se houver mais de uma) */}
        {tabelas.length > 1 && (
          <select
            value={selectedTabela}
            onChange={(e) => setSelectedTabela(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-700 outline-none focus:border-teal-500"
            aria-label="Tabela de Preço"
          >
            {tabelas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        )}

        {/* Controles de Quantidade e Adicionar (Estilo Lavizoo) */}
        <div className="mt-auto pt-3 space-y-1.5">
          <div className="flex items-center justify-between rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200/60">
            <button
              onClick={handleDec}
              className="flex h-8 w-10 items-center justify-center rounded-lg text-slate-700 active:bg-slate-200 transition-colors"
              aria-label="Diminuir quantidade"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              min="1"
              max="9999"
              value={qty}
              onChange={handleInputChange}
              inputMode="numeric"
              aria-label="Quantidade"
              className="h-8 w-16 bg-transparent text-center text-xs sm:text-sm font-bold text-slate-900 focus:outline-none"
            />
            <button
              onClick={handleInc}
              className="flex h-8 w-10 items-center justify-center rounded-lg text-slate-700 active:bg-slate-200 transition-colors"
              aria-label="Aumentar quantidade"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={handleAdd}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-teal-800 px-2 text-xs font-bold text-white shadow-sm transition-all active:scale-[0.98] hover:bg-teal-700"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>Adicionar • {subtotalLinha}</span>
          </button>
        </div>
      </div>
    </article>
  )
}
