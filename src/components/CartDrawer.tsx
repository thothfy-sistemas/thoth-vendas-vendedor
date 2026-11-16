import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Trash2,
  Send,
  MessageCircle,
  FileText,
  UserCheck,
  ChevronRight,
  Minus,
  Plus,
  BookmarkPlus,
  Percent,
  DollarSign,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react'
import type { ItemCarrinho, Cliente, FormaPagamento, PrazoPagamento } from '../types'
import { formatarWhatsApp, abrirWhatsApp, gerarPdfPedido } from '../services/share'

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
  itens: ItemCarrinho[]
  onUpdateQty: (produtoId: string, quantidade: number) => void
  onUpdateDesconto?: (produtoId: string, descontoPct: number) => void
  onRemoveItem: (produtoId: string) => void
  onClearCart: () => void
  selectedCliente: Cliente | null
  onOpenClienteSelect: () => void
  onClearCliente?: () => void
  onSubmitOrder: (
    observacoes: string,
    condicao: string,
    formaPagamento: string,
    formaPagamentoId?: string,
    prazoPagamentoId?: string
  ) => Promise<void>
  onSaveOrcamento?: (
    observacoes: string,
    condicao: string,
    formaPagamento: string,
    formaPagamentoId?: string,
    prazoPagamentoId?: string
  ) => Promise<void>
  isSubmitting: boolean
  limiteDescontoPct?: number
  valorPedidoMinimo?: number
  empresaNome?: string
  formasPagamento?: FormaPagamento[]
  prazosPagamento?: PrazoPagamento[]
}

const CONDICOES_PAGAMENTO = [
  'À Vista',
  'PIX',
  'Boleto 7 dias',
  'Boleto 14 dias',
  'Boleto 21 dias',
  'Boleto 28 dias',
  'Boleto 30 dias',
  'Boleto 14/28 dias',
  'Boleto 28/42 dias',
  'Boleto 30/60 dias',
  'Boleto 28/42/56 dias',
  'Boleto 30/60/90 dias',
  'Cartão de Crédito',
]

const FORMAS_PAGAMENTO = [
  { id: 'boleto', label: 'Boleto Bancário' },
  { id: 'pix', label: 'PIX' },
  { id: 'cartao', label: 'Cartão de Crédito/Débito' },
  { id: 'dinheiro', label: 'Dinheiro / À Vista' },
  { id: 'transferencia', label: 'Transferência / TED' },
]

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  itens,
  onUpdateQty,
  onUpdateDesconto,
  onRemoveItem,
  onClearCart,
  selectedCliente,
  onOpenClienteSelect,
  onClearCliente,
  onSubmitOrder,
  onSaveOrcamento,
  isSubmitting,
  limiteDescontoPct = 15,
  valorPedidoMinimo = 0,
  empresaNome = 'ThothVendas',
  formasPagamento = [],
  prazosPagamento = [],
}) => {
  const [condicao, setCondicao] = useState<string>('À Vista')
  const [formaPagamento, setFormaPagamento] = useState<string>('boleto')
  const [formaPagamentoId, setFormaPagamentoId] = useState<string>('')
  const [prazoPagamentoId, setPrazoPagamentoId] = useState<string>('')
  const [observacoes, setObservacoes] = useState<string>('')
  const [modoDescontoGeral, setModoDescontoGeral] = useState<'pct' | 'valor'>('pct')
  const [descontoGlobalPct, setDescontoGlobalPct] = useState<string>('')
  const [descontoGlobalValor, setDescontoGlobalValor] = useState<string>('')
  const [modoItemMap, setModoItemMap] = useState<Record<string, 'pct' | 'valor'>>({})
  const [savingOrcamento, setSavingOrcamento] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const scrollBodyRef = useRef<HTMLDivElement>(null)

  const subtotal = itens.reduce((acc, it) => acc + it.quantidade * it.precoUnitarioCobrado, 0)
  const totalDesconto = itens.reduce(
    (acc, it) => acc + it.quantidade * it.precoUnitarioCobrado * ((it.descontoPct || 0) / 100),
    0
  )
  const total = Math.max(0, subtotal - totalDesconto)
  const maxDescontoValor = subtotal * (limiteDescontoPct / 100)
  const pctEfetivoGeral = subtotal > 0 ? (totalDesconto / subtotal) * 100 : 0

  useEffect(() => {
    if (itens.length === 0) {
      setDescontoGlobalPct('')
      setDescontoGlobalValor('')
      setConfirmClear(false)
    }
  }, [itens.length])

  useEffect(() => {
    if (selectedCliente) {
      setFormError(null)
    }
  }, [selectedCliente])

  useEffect(() => {
    if (formasPagamento.length > 0 && !formaPagamentoId) {
      setFormaPagamentoId(formasPagamento[0].id)
      setFormaPagamento(formasPagamento[0].tipo || formasPagamento[0].nome)
    }
  }, [formasPagamento, formaPagamentoId])

  useEffect(() => {
    if (prazosPagamento.length > 0 && !prazoPagamentoId) {
      setPrazoPagamentoId(prazosPagamento[0].id)
      setCondicao(prazosPagamento[0].nome)
    }
  }, [prazosPagamento, prazoPagamentoId])

  if (!isOpen) return null

  const fmtBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const handleCondicaoChange = (novaCondicao: string) => {
    setCondicao(novaCondicao)
    const lower = novaCondicao.toLowerCase()
    if (lower.includes('pix')) setFormaPagamento('pix')
    else if (lower.includes('cartão') || lower.includes('cartao')) setFormaPagamento('cartao')
    else if (lower.includes('boleto')) setFormaPagamento('boleto')
    else if (lower.includes('vista')) setFormaPagamento('dinheiro')
  }

  const handleApplyDescontoPct = (pctRaw: number) => {
    const capped = Math.min(Math.max(0, pctRaw), limiteDescontoPct)
    setDescontoGlobalPct(capped > 0 ? String(Number(capped.toFixed(2))) : '')
    const valReais = subtotal * (capped / 100)
    setDescontoGlobalValor(valReais > 0 ? valReais.toFixed(2) : '')
    if (onUpdateDesconto) {
      itens.forEach((it) => onUpdateDesconto(it.produtoId, capped))
    }
  }

  const handleApplyDescontoValor = (valorRaw: number) => {
    if (subtotal <= 0) return
    const cappedVal = Math.min(Math.max(0, valorRaw), maxDescontoValor)
    setDescontoGlobalValor(cappedVal > 0 ? String(Number(cappedVal.toFixed(2))) : '')
    const eqPct = Math.min((cappedVal / subtotal) * 100, limiteDescontoPct)
    setDescontoGlobalPct(eqPct > 0 ? eqPct.toFixed(2) : '')
    if (onUpdateDesconto) {
      itens.forEach((it) => onUpdateDesconto(it.produtoId, eqPct))
    }
  }

  const handleWhatsApp = () => {
    const texto = formatarWhatsApp(selectedCliente, itens, condicao, total, observacoes, {
      empresaNome,
    })
    abrirWhatsApp(selectedCliente?.telefone || selectedCliente?.celular, texto)
  }

  const handlePdf = () => {
    gerarPdfPedido(selectedCliente, itens, condicao, total, observacoes, { empresaNome })
  }

  const abaixoMinimo = valorPedidoMinimo > 0 && total < valorPedidoMinimo
  const excedeLimiteCredito =
    !!selectedCliente &&
    selectedCliente.limite_credito > 0 &&
    selectedCliente.saldo_devedor + total > selectedCliente.limite_credito

  const showDrawerError = (msg: string) => {
    setFormError(msg)
    scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    setFormError(null)
    if (!selectedCliente) {
      showDrawerError('Selecione um cliente antes de transmitir o pedido.')
      onOpenClienteSelect()
      return
    }
    if (selectedCliente.bloqueado) {
      showDrawerError(
        `Cliente bloqueado${selectedCliente.motivo_bloqueio ? `: ${selectedCliente.motivo_bloqueio}` : ''}. Salve como orçamento ou escolha outro cliente.`
      )
      return
    }
    if (abaixoMinimo) {
      showDrawerError(`Valor mínimo do pedido é ${fmtBRL(valorPedidoMinimo)}.`)
      return
    }
    try {
      await onSubmitOrder(
        observacoes,
        condicao,
        formaPagamento,
        formaPagamentoId || undefined,
        prazoPagamentoId || undefined
      )
    } catch (err: any) {
      showDrawerError(err?.message || 'Não foi possível transmitir o pedido. Tente novamente.')
    }
  }

  const handleSalvarOrcamentoClick = async () => {
    if (!onSaveOrcamento) return
    setFormError(null)
    setSavingOrcamento(true)
    try {
      await onSaveOrcamento(
        observacoes,
        condicao,
        formaPagamento,
        formaPagamentoId || undefined,
        prazoPagamentoId || undefined
      )
    } catch (err: any) {
      showDrawerError(err?.message || 'Não foi possível salvar o orçamento.')
    } finally {
      setSavingOrcamento(false)
    }
  }

  const atalhosValor = [10, 20, 50, 100, Math.floor(maxDescontoValor)]
    .filter((v, idx, arr) => v > 0 && v <= maxDescontoValor && arr.indexOf(v) === idx)
    .slice(0, 5)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative z-10 flex h-[100dvh] w-full max-w-md flex-col bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5 shrink-0">
          <div>
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Resumo do Pedido / Orçamento
            </h2>
            <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {itens.length} produto(s) • {itens.reduce((a, b) => a + b.quantidade, 0)} un.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div
          ref={scrollBodyRef}
          className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-4 bg-[#F8FAFC] dark:bg-[#090D16]"
        >
          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Seleção do Cliente */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Cliente do Pedido
              </span>
              <div className="flex items-center gap-3">
                {selectedCliente && onClearCliente && (
                  <button
                    type="button"
                    onClick={onClearCliente}
                    className="text-xs font-semibold text-rose-500 hover:text-rose-600 transition-colors"
                  >
                    Remover
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenClienteSelect}
                  className="text-xs font-semibold text-[#00A19C] hover:text-[#0F766E] flex items-center gap-0.5"
                >
                  {selectedCliente ? 'Trocar cliente' : 'Selecionar'} <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {selectedCliente ? (
              <div className="space-y-2">
                <div className="rounded-xl bg-[#F8FAFC] dark:bg-slate-800/60 p-2.5 border border-slate-200/80 dark:border-slate-700 flex items-start gap-2.5">
                  <div className="rounded-lg bg-[#00A19C]/10 p-2 text-[#00A19C] shrink-0">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                      {selectedCliente.razao_social}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      CPF/CNPJ: {selectedCliente.cpf_cnpj}
                    </p>
                    {selectedCliente.cidade && (
                      <p className="text-[10px] text-slate-400">
                        {selectedCliente.cidade}/{selectedCliente.estado}
                      </p>
                    )}
                  </div>
                </div>

                {selectedCliente.bloqueado && (
                  <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 p-2.5 text-[11px] text-rose-700 dark:text-rose-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      Cliente bloqueado{selectedCliente.motivo_bloqueio ? `: ${selectedCliente.motivo_bloqueio}` : '.'}
                    </span>
                  </div>
                )}

                {excedeLimiteCredito && !selectedCliente.bloqueado && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      Atenção: saldo + pedido ({fmtBRL(selectedCliente.saldo_devedor + total)}) excede o limite de crédito ({fmtBRL(selectedCliente.limite_credito)}).
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenClienteSelect}
                className="w-full rounded-xl border border-dashed border-[#00A19C]/50 py-2.5 text-center text-xs font-semibold text-[#00A19C] hover:bg-[#00A19C]/5 transition-all"
              >
                + Toque para escolher o cliente
              </button>
            )}
          </div>

          {/* Forma & Condição de Pagamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Forma de Pagamento
              </label>
              {formasPagamento.length > 0 ? (
                <select
                  value={formaPagamentoId}
                  onChange={(e) => {
                    const f = formasPagamento.find((x) => x.id === e.target.value)
                    setFormaPagamentoId(e.target.value)
                    if (f) setFormaPagamento(f.tipo || f.nome)
                  }}
                  className="w-full rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-[#00A19C]"
                >
                  {formasPagamento.map((fp) => (
                    <option key={fp.id} value={fp.id}>
                      {fp.nome}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value)}
                  className="w-full rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-[#00A19C]"
                >
                  {FORMAS_PAGAMENTO.map((fp) => (
                    <option key={fp.id} value={fp.id}>
                      {fp.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Condição / Prazo
              </label>
              {prazosPagamento.length > 0 ? (
                <select
                  value={prazoPagamentoId}
                  onChange={(e) => {
                    const p = prazosPagamento.find((x) => x.id === e.target.value)
                    setPrazoPagamentoId(e.target.value)
                    if (p) setCondicao(p.nome)
                  }}
                  className="w-full rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-[#00A19C]"
                >
                  {prazosPagamento.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={condicao}
                  onChange={(e) => handleCondicaoChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-[#00A19C]"
                >
                  {CONDICOES_PAGAMENTO.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Desconto Geral */}
          {itens.length > 0 && (
            <div className="rounded-xl border border-teal-200/80 dark:border-[#00A19C]/30 bg-teal-50/50 dark:bg-[#00A19C]/10 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Desconto Geral
                  </span>
                  <span className="text-[10px] text-[#0F766E] dark:text-teal-300 font-medium font-mono tabular-nums">
                    Limite máx: <strong>{limiteDescontoPct}%</strong> ({fmtBRL(maxDescontoValor)})
                  </span>
                </div>

                <div className="inline-flex rounded-xl bg-white dark:bg-slate-900 p-0.5 border border-slate-200/80 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setModoDescontoGeral('pct')}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                      modoDescontoGeral === 'pct'
                        ? 'bg-[#00A19C] text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Percent className="h-3 w-3" />
                    <span>%</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoDescontoGeral('valor')}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                      modoDescontoGeral === 'valor'
                        ? 'bg-[#00A19C] text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <DollarSign className="h-3 w-3" />
                    <span>R$</span>
                  </button>
                </div>
              </div>

              {modoDescontoGeral === 'pct' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        max={limiteDescontoPct}
                        step="0.5"
                        inputMode="decimal"
                        value={descontoGlobalPct}
                        onChange={(e) => {
                          setDescontoGlobalPct(e.target.value)
                          const val = parseFloat(e.target.value)
                          handleApplyDescontoPct(isNaN(val) ? 0 : val)
                        }}
                        placeholder="Ex: 5 ou 10"
                        className="w-full rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 pl-3 pr-8 font-mono tabular-nums text-xs font-bold text-slate-900 dark:text-white focus:outline-[#00A19C]"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#00A19C]">
                        %
                      </span>
                    </div>
                    <div className="text-right shrink-0 min-w-[90px]">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Desconto R$</div>
                      <div className="font-mono tabular-nums text-xs font-bold text-[#00A19C]">
                        - {fmtBRL(totalDesconto)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    {[0, 5, 10, 15, 20, 25, limiteDescontoPct]
                      .filter((v, idx, arr) => v <= limiteDescontoPct && arr.indexOf(v) === idx)
                      .map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => handleApplyDescontoPct(pct)}
                          className={`px-2 py-1 rounded-lg font-mono tabular-nums text-[10px] font-semibold transition-all ${
                            Math.abs(pctEfetivoGeral - pct) < 0.1 && (pct > 0 || totalDesconto === 0)
                              ? 'bg-[#00A19C] text-white shadow-2xs'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
                          }`}
                        >
                          {pct === 0 ? '0%' : pct === limiteDescontoPct ? `Máx ${pct}%` : `${pct}%`}
                        </button>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#00A19C]">
                        R$
                      </span>
                      <input
                        type="number"
                        min="0"
                        max={Number(maxDescontoValor.toFixed(2))}
                        step="1"
                        inputMode="decimal"
                        value={descontoGlobalValor}
                        onChange={(e) => {
                          setDescontoGlobalValor(e.target.value)
                          const val = parseFloat(e.target.value)
                          handleApplyDescontoValor(isNaN(val) ? 0 : val)
                        }}
                        placeholder="Ex: 20,00"
                        className="w-full rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 pl-9 pr-3 font-mono tabular-nums text-xs font-bold text-slate-900 dark:text-white focus:outline-[#00A19C]"
                      />
                    </div>
                    <div className="text-right shrink-0 min-w-[90px]">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Equivalente a</div>
                      <div className="font-mono tabular-nums text-xs font-bold text-[#00A19C]">
                        {pctEfetivoGeral.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleApplyDescontoValor(0)}
                      className={`px-2 py-1 rounded-lg font-mono tabular-nums text-[10px] font-semibold transition-all ${
                        totalDesconto === 0
                          ? 'bg-[#00A19C] text-white'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
                      }`}
                    >
                      R$ 0
                    </button>
                    {atalhosValor.map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleApplyDescontoValor(val)}
                        className={`px-2 py-1 rounded-lg font-mono tabular-nums text-[10px] font-semibold transition-all ${
                          Math.abs(totalDesconto - val) < 0.5
                            ? 'bg-[#00A19C] text-white'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
                        }`}
                      >
                        R$ {val}
                      </button>
                    ))}
                    {maxDescontoValor > 0 && (
                      <button
                        type="button"
                        onClick={() => handleApplyDescontoValor(maxDescontoValor)}
                        className="px-2 py-1 rounded-lg font-mono tabular-nums text-[10px] font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700"
                      >
                        Máx ({fmtBRL(maxDescontoValor)})
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Lista de Itens */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Itens do Pedido ({itens.length})
              </span>
              {itens.length > 0 && (
                confirmClear ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onClearCart()
                        setConfirmClear(false)
                      }}
                      className="rounded-lg bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="rounded-lg bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    Limpar tudo
                  </button>
                )
              )}
            </div>

            {itens.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-slate-400">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Seu pedido está vazio</p>
                <p className="text-[11px] mt-0.5">Adicione produtos pelo catálogo para iniciar.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                {itens.map((it) => {
                  const subBruto = it.quantidade * it.precoUnitarioCobrado
                  const descReaisItem = subBruto * ((it.descontoPct || 0) / 100)
                  const maxReaisItem = subBruto * (limiteDescontoPct / 100)
                  const totalLiquidoItem = subBruto - descReaisItem
                  const modoItem = modoItemMap[it.produtoId] || 'pct'

                  return (
                    <div key={it.produtoId} className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white leading-snug">
                            {it.nome}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                            #{it.codigo} • {fmtBRL(it.precoUnitarioCobrado)}/{it.unidade}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(it.produtoId)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors shrink-0"
                          aria-label="Remover item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() =>
                              setModoItemMap((prev) => ({
                                ...prev,
                                [it.produtoId]: modoItem === 'pct' ? 'valor' : 'pct',
                              }))
                            }
                            className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-[#00A19C] border border-slate-200/80 dark:border-slate-700"
                            title="Alternar entre desconto em % ou R$"
                          >
                            Desc ({modoItem === 'pct' ? '%' : 'R$'}):
                          </button>

                          {modoItem === 'pct' ? (
                            <input
                              type="number"
                              min="0"
                              max={limiteDescontoPct}
                              step="0.5"
                              inputMode="decimal"
                              value={it.descontoPct ? Number(it.descontoPct.toFixed(2)) : ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                const capped = Math.min(Math.max(0, val), limiteDescontoPct)
                                if (onUpdateDesconto) onUpdateDesconto(it.produtoId, capped)
                              }}
                              placeholder="0%"
                              className="w-14 px-1.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 text-center text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-[#00A19C]"
                            />
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max={Number(maxReaisItem.toFixed(2))}
                              step="0.5"
                              inputMode="decimal"
                              value={descReaisItem > 0 ? Number(descReaisItem.toFixed(2)) : ''}
                              onChange={(e) => {
                                const valReais = parseFloat(e.target.value) || 0
                                const cappedReais = Math.min(Math.max(0, valReais), maxReaisItem)
                                const pct = subBruto > 0 ? (cappedReais / subBruto) * 100 : 0
                                if (onUpdateDesconto) onUpdateDesconto(it.produtoId, pct)
                              }}
                              placeholder="R$ 0"
                              className="w-16 px-1.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 text-center text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-[#00A19C]"
                            />
                          )}
                        </div>

                        <div className="flex items-center rounded-xl bg-[#F8FAFC] dark:bg-slate-800 p-0.5 border border-slate-200/80 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(it.produtoId, Math.max(1, it.quantidade - 1))}
                            className="p-1.5 text-slate-600 dark:text-slate-300 active:bg-slate-200 dark:active:bg-slate-700 rounded-lg"
                            aria-label="Diminuir"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center font-mono tabular-nums text-xs font-bold text-slate-900 dark:text-white">
                            {it.quantidade}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(it.produtoId, it.quantidade + 1)}
                            className="p-1.5 text-slate-600 dark:text-slate-300 active:bg-slate-200 dark:active:bg-slate-700 rounded-lg"
                            aria-label="Aumentar"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="text-right min-w-[78px]">
                          <p className="font-mono tabular-nums text-xs font-bold text-[#00A19C]">
                            {fmtBRL(totalLiquidoItem)}
                          </p>
                          {it.descontoPct > 0 && (
                            <p className="font-mono tabular-nums text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              -{it.descontoPct.toFixed(1)}%
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Observações (Entrega, Prazo, OC)
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Entregar no período da manhã, falar com responsável..."
              rows={2}
              className="w-full rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-[#00A19C] resize-none"
            />
          </div>
        </div>

        {/* Rodapé Fixo */}
        <div className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 space-y-2.5 shrink-0 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          {abaixoMinimo && itens.length > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300 font-mono tabular-nums">
              Pedido mínimo da empresa: {fmtBRL(valorPedidoMinimo)} (faltam {fmtBRL(valorPedidoMinimo - total)})
            </div>
          )}

          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span>Subtotal Bruto</span>
              <span className="font-mono tabular-nums">{fmtBRL(subtotal)}</span>
            </div>
            {totalDesconto > 0 && (
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                <span>Desconto Total ({pctEfetivoGeral.toFixed(1)}%)</span>
                <span className="font-mono tabular-nums">- {fmtBRL(totalDesconto)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/80 dark:border-slate-800">
              <span className="font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Total Líquido
              </span>
              <span className="font-display font-mono tabular-nums text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                {fmtBRL(total)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {onSaveOrcamento && (
              <button
                type="button"
                onClick={handleSalvarOrcamentoClick}
                disabled={itens.length === 0 || savingOrcamento || isSubmitting}
                className="col-span-2 flex h-11 items-center justify-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 font-semibold text-xs text-amber-800 dark:text-amber-300 active:scale-[0.98] transition-all hover:bg-amber-100 dark:hover:bg-amber-500/20 disabled:opacity-50"
              >
                <BookmarkPlus className="h-4 w-4 shrink-0" />
                <span>{savingOrcamento ? 'Salvando...' : 'Salvar Orç.'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={itens.length === 0 || isSubmitting}
              className={`${
                onSaveOrcamento ? 'col-span-3' : 'col-span-5'
              } flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#00A19C] font-semibold text-xs uppercase tracking-wider text-white shadow-sm active:scale-[0.98] transition-all hover:bg-[#008C87] disabled:opacity-50`}
            >
              <Send className="h-4 w-4 shrink-0" />
              <span>{isSubmitting ? 'Transmitindo...' : 'Transmitir Pedido'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleWhatsApp}
              disabled={itens.length === 0}
              className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 font-semibold text-xs text-white active:scale-[0.98] transition-all hover:bg-emerald-500 disabled:opacity-50"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Enviar WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={handlePdf}
              disabled={itens.length === 0}
              className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-xs text-slate-700 dark:text-slate-200 active:scale-[0.98] transition-all hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5 text-[#00A19C]" />
              <span>Gerar PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
