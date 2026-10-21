import React, { useState, useMemo } from 'react'
import { X, Search, Check, AlertTriangle } from 'lucide-react'
import type { Cliente } from '../types'

interface ClientSelectModalProps {
  isOpen: boolean
  onClose: () => void
  clientes: Cliente[]
  selectedCliente: Cliente | null
  onSelect: (cliente: Cliente) => void
}

export const ClientSelectModal: React.FC<ClientSelectModalProps> = ({
  isOpen,
  onClose,
  clientes,
  selectedCliente,
  onSelect,
}) => {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return clientes.slice(0, 50)
    const term = search.toLowerCase().trim()
    return clientes
      .filter(
        (c) =>
          c.razao_social.toLowerCase().includes(term) ||
          (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(term)) ||
          c.cpf_cnpj.includes(term) ||
          (c.cidade && c.cidade.toLowerCase().includes(term))
      )
      .slice(0, 50)
  }, [clientes, search])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 flex h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#0F3C46] px-5 py-4 text-white">
          <div>
            <h2 className="text-base font-bold">Selecionar Cliente</h2>
            <p className="text-xs text-teal-200">Escolha o cliente para faturar o pedido</p>
          </div>
          <button onClick={onClose} className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Busca */}
        <div className="border-b border-slate-200 p-3 bg-slate-50">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por razão social, CNPJ ou cidade..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs sm:text-sm outline-none focus:border-teal-500"
              autoFocus
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">Nenhum cliente encontrado.</div>
          ) : (
            filtered.map((c) => {
              const isSelected = selectedCliente?.id === c.id
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onSelect(c)
                    onClose()
                  }}
                  className={`cursor-pointer rounded-xl p-3 transition-colors flex items-center justify-between gap-3 ${
                    isSelected ? 'bg-teal-50 border border-teal-200' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs font-bold text-slate-900">{c.razao_social}</p>
                      {c.bloqueado && (
                        <span className="shrink-0 flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">
                          <AlertTriangle className="h-2.5 w-2.5" /> Bloqueado
                        </span>
                      )}
                    </div>
                    {c.nome_fantasia && (
                      <p className="truncate text-[11px] text-slate-600">{c.nome_fantasia}</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      CNPJ: {c.cpf_cnpj} {c.cidade ? `• ${c.cidade}/${c.estado}` : ''}
                    </p>
                  </div>

                  {isSelected && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-white shrink-0">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
