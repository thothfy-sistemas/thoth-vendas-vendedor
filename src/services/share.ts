import { jsPDF } from 'jspdf'
import type { Cliente, ItemCarrinho, Pedido } from '../types'

const fmtBRL = (val: number) =>
  Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatarWhatsApp(
  cliente: Cliente | null,
  itens: ItemCarrinho[],
  condicao: string,
  total: number,
  observacoes?: string,
  opts?: { numero?: string; empresaNome?: string; isOrcamento?: boolean }
): string {
  const dataHoje = new Date().toLocaleDateString('pt-BR')
  const titulo = opts?.isOrcamento ? 'ORÇAMENTO COMERCIAL' : 'PEDIDO DE VENDA'
  const headerBrand = opts?.empresaNome ? `${opts.empresaNome} • ThothVendas` : 'ThothVendas'

  let texto = `*${titulo}${opts?.numero ? ` #${opts.numero}` : ''}*\n`
  texto += `${headerBrand}\n`
  texto += `Data: ${dataHoje}\n`
  if (cliente) {
    texto += `Cliente: *${cliente.razao_social}*\n`
    if (cliente.cpf_cnpj) {
      texto += `CNPJ/CPF: ${cliente.cpf_cnpj}\n`
    }
    if (cliente.cidade) {
      texto += `Cidade: ${cliente.cidade}${cliente.estado ? ` - ${cliente.estado}` : ''}\n`
    }
  }
  texto += `Condicao: ${condicao || 'A Vista'}\n`
  texto += `\n*ITENS:*\n`

  itens.forEach((it, idx) => {
    const unitNet = it.quantidade > 0 ? it.subtotal / it.quantidade : it.precoUnitarioCobrado
    const unitFmt = fmtBRL(it.precoUnitarioCobrado)
    const unitNetFmt = fmtBRL(unitNet)
    const subFmt = fmtBRL(it.subtotal)
    const temDesc = it.descontoPct > 0 || it.subtotal < it.quantidade * it.precoUnitarioCobrado - 0.01
    texto += `${idx + 1}. *[#${it.codigo || '-'}]* ${it.nome}\n`
    texto += `   ${it.quantidade} ${it.unidade || 'UN'} x `
    if (temDesc) {
      texto += `${unitFmt} (-${it.descontoPct.toFixed(1)}% -> *${unitNetFmt}/un*)`
    } else {
      texto += `${unitFmt}`
    }
    texto += ` = *${subFmt}*\n`
  })

  texto += `\n*VALOR TOTAL: ${fmtBRL(total)}*\n`

  if (observacoes && observacoes.trim()) {
    texto += `Obs: ${observacoes.trim()}\n`
  }

  return texto
}

export function formatarWhatsAppPedidoServidor(pedido: Pedido, empresaNome: string): string {
  const dataFmt = new Date(pedido.created_at).toLocaleDateString('pt-BR')
  const tipo = pedido.status === 'orcamento' ? 'ORÇAMENTO COMERCIAL' : 'PEDIDO DE VENDA'
  let texto = `*${tipo} #${pedido.numero || pedido.id.slice(0, 8)}*\n`
  texto += `${empresaNome} • ThothVendas\n`
  texto += `Data: ${dataFmt}\n`
  texto += `Cliente: *${pedido.cliente_nome || 'Cliente'}*\n`
  if (pedido.condicao_pagamento) {
    texto += `Condicao: ${pedido.condicao_pagamento}\n`
  }
  texto += `Status: ${String(pedido.status || 'REGISTRADO').toUpperCase()}\n`

  if (pedido.itens && pedido.itens.length > 0) {
    texto += `\n*ITENS:*\n`
    pedido.itens.forEach((it, idx) => {
      const unitNet = it.quantidade > 0 ? it.valor_total / it.quantidade : it.preco_unitario_cobrado
      const temDesc = (it.desconto_pct || 0) > 0 || it.valor_total < it.quantidade * it.preco_unitario_cobrado - 0.01
      texto += `${idx + 1}. *[#${it.codigo_produto || '-'}]* ${it.nome_produto}\n`
      if (temDesc) {
        texto += `   ${it.quantidade} ${it.unidade || 'UN'} x ${fmtBRL(it.preco_unitario_cobrado)} (-${Number(it.desconto_pct || 0).toFixed(1)}% -> *${fmtBRL(unitNet)}/un*) = *${fmtBRL(it.valor_total)}*\n`
      } else {
        texto += `   ${it.quantidade} ${it.unidade || 'UN'} x ${fmtBRL(it.preco_unitario_cobrado)} = *${fmtBRL(it.valor_total)}*\n`
      }
    })
  }

  texto += `\n*VALOR TOTAL: ${fmtBRL(pedido.valor_total)}*\n`
  if (pedido.observacao && pedido.observacao.trim()) {
    texto += `Obs: ${pedido.observacao.trim()}\n`
  }
  return texto
}

export function abrirWhatsApp(telefone: string | undefined, texto: string) {
  const cleanPhone = (telefone || '').replace(/\D/g, '')
  const encodedText = encodeURIComponent(texto)
  if (cleanPhone.length >= 10) {
    const finalPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
    window.open(`https://wa.me/${finalPhone}?text=${encodedText}`, '_blank')
  } else {
    window.open(`https://wa.me/?text=${encodedText}`, '_blank')
  }
}

export function gerarPdfPedido(
  cliente: Cliente | null,
  itens: ItemCarrinho[],
  condicao: string,
  total: number,
  observacoes?: string,
  opts?: { numero?: string; empresaNome?: string; isOrcamento?: boolean; dataEmissao?: string }
) {
  const doc = new jsPDF()
  const dataHoje = opts?.dataEmissao || new Date().toLocaleDateString('pt-BR')
  const titulo = opts?.isOrcamento ? 'ORÇAMENTO COMERCIAL' : 'PEDIDO DE VENDA'
  const headerSub = opts?.empresaNome ? `${opts.empresaNome} • ThothVendas` : 'ThothVendas • Força de Vendas B2B'

  // Cabeçalho Oficial Teal Comercial #00A19C
  doc.setFillColor(0, 161, 156)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text(`${titulo}${opts?.numero ? ` #${opts.numero}` : ''}`, 14, 14)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(headerSub, 14, 22)
  doc.text(`Emissão: ${dataHoje}`, 160, 14)

  // Dados do Cliente
  let y = 38
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('DADOS DO CLIENTE & COBRANÇA', 14, y)

  y += 6
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Cliente: ${cliente?.razao_social || 'Consumidor / Não informado'}`, 14, y)
  doc.text(`CNPJ/CPF: ${cliente?.cpf_cnpj || '-'}`, 130, y)

  y += 5
  doc.text(`Cidade/UF: ${cliente?.cidade ? `${cliente.cidade}/${cliente.estado || ''}` : '-'}`, 14, y)
  doc.text(`Condição: ${condicao || 'À Vista'}`, 130, y)

  // Linha divisória
  y += 8
  doc.setDrawColor(226, 232, 240)
  doc.line(14, y, 196, y)

  // Tabela de Itens (Header)
  y += 7
  doc.setFillColor(241, 245, 249)
  doc.rect(14, y - 4, 182, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(71, 85, 105)

  doc.text('CÓD', 15, y)
  doc.text('DESCRIÇÃO DO PRODUTO', 31, y)
  doc.text('QTD', 102, y)
  doc.text('UN', 114, y)
  doc.text('UNIT (R$)', 124, y)
  doc.text('DESC', 144, y)
  doc.text('C/ DESC', 158, y)
  doc.text('TOTAL (R$)', 177, y)

  // Itens
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(15, 23, 42)

  let brutoTotal = 0
  if (itens.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(100, 116, 139)
    doc.text('Itens consolidados no pedido.', 16, y)
    y += 6
  } else {
    itens.forEach((it) => {
      if (y > 265) {
        doc.addPage()
        y = 20
      }
      const brutoItem = it.quantidade * it.precoUnitarioCobrado
      brutoTotal += brutoItem
      const unitNet = it.quantidade > 0 ? it.subtotal / it.quantidade : it.precoUnitarioCobrado
      const descPct =
        it.descontoPct > 0
          ? it.descontoPct
          : brutoItem > it.subtotal + 0.01
            ? ((brutoItem - it.subtotal) / brutoItem) * 100
            : 0

      const unitStr = it.precoUnitarioCobrado.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      const descStr = descPct > 0 ? `${descPct.toFixed(1).replace('.', ',')}%` : '-'
      const unitNetStr = unitNet.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      const subStr = it.subtotal.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

      doc.text((it.codigo || '-').slice(0, 9), 15, y)
      doc.text(it.nome.slice(0, 34), 31, y)
      doc.text(String(it.quantidade), 102, y)
      doc.text(it.unidade || 'UN', 114, y)
      doc.text(unitStr, 124, y)
      doc.text(descStr, 144, y)
      doc.text(unitNetStr, 158, y)
      doc.text(subStr, 177, y)

      y += 6
    })
  }

  // Total
  y += 4
  doc.setDrawColor(226, 232, 240)
  doc.line(14, y, 196, y)

  const descontoTotal = Math.max(0, brutoTotal - total)
  if (descontoTotal > 0.01) {
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(`Subtotal Bruto: ${fmtBRL(brutoTotal)}`, 130, y)
    y += 5
    doc.setTextColor(220, 38, 38)
    doc.text(`Desconto Aplicado: -${fmtBRL(descontoTotal)}`, 130, y)
  }

  y += 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(0, 161, 156)
  doc.text(`VALOR TOTAL: ${fmtBRL(total)}`, 130, y)

  if (observacoes && observacoes.trim()) {
    y += 10
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(100, 116, 139)
    doc.text(`Observações: ${observacoes.trim().slice(0, 120)}`, 14, y)
  }

  // Rodapé
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text('ThothVendas • Documento emitido pelo App do Vendedor', 14, 285)

  const filePrefix = opts?.isOrcamento ? 'orcamento' : 'pedido'
  const fileSuffix = opts?.numero || new Date().toISOString().slice(0, 10)
  doc.save(`${filePrefix}-${fileSuffix}.pdf`)
}
