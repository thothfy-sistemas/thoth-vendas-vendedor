import { jsPDF } from 'jspdf'
import type { Cliente, ItemCarrinho } from '../types'

export function formatarWhatsApp(
  cliente: Cliente | null,
  itens: ItemCarrinho[],
  condicao: string,
  total: number,
  observacoes?: string
): string {
  const dataHoje = new Date().toLocaleDateString('pt-BR')
  let texto = `🛒 *PEDIDO DE VENDA • THOTH VENDAS*\n`
  texto += `📅 *Data:* ${dataHoje}\n`
  if (cliente) {
    texto += `👤 *Cliente:* ${cliente.razao_social}\n`
    texto += `📄 *CNPJ/CPF:* ${cliente.cpf_cnpj}\n`
    if (cliente.cidade) {
      texto += `📍 *Cidade:* ${cliente.cidade} - ${cliente.estado || 'SP'}\n`
    }
  }
  texto += `💳 *Condição:* ${condicao || 'À Vista'}\n`
  texto += `\n*ITENS DO PEDIDO:*\n`

  itens.forEach((it, idx) => {
    const unitFmt = it.precoUnitarioCobrado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const subFmt = it.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    texto += `${idx + 1}. *[#${it.codigo}]* ${it.nome}\n`
    texto += `   ${it.quantidade} ${it.unidade} x ${unitFmt} = *${subFmt}*\n`
  })

  const totalFmt = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  texto += `\n💰 *VALOR TOTAL: ${totalFmt}*\n`

  if (observacoes && observacoes.trim()) {
    texto += `📝 *Obs:* ${observacoes.trim()}\n`
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
  observacoes?: string
) {
  const doc = new jsPDF()
  const dataHoje = new Date().toLocaleDateString('pt-BR')

  // Cabeçalho
  doc.setFillColor(21, 95, 110) // Brand Teal #155F6E
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('THOTH VENDAS • PEDIDO DE VENDA', 14, 18)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Data: ${dataHoje}`, 160, 18)

  // Dados do Cliente
  let y = 38
  doc.setTextColor(30, 41, 59)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('DADOS DO CLIENTE & COBRANÇA', 14, y)

  y += 6
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Cliente: ${cliente?.razao_social || 'Consumidor / Não informado'}`, 14, y)
  doc.text(`CNPJ/CPF: ${cliente?.cpf_cnpj || '-'}`, 130, y)

  y += 5
  doc.text(`Cidade/UF: ${cliente?.cidade ? `${cliente.cidade}/${cliente.estado}` : '-'}`, 14, y)
  doc.text(`Condição de Pagamento: ${condicao || 'À Vista'}`, 130, y)

  // Linha divisória
  y += 8
  doc.setDrawColor(203, 213, 225)
  doc.line(14, y, 196, y)

  // Tabela de Itens (Header)
  y += 7
  doc.setFillColor(241, 245, 249)
  doc.rect(14, y - 4, 182, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)

  doc.text('CÓD', 16, y)
  doc.text('DESCRIÇÃO DO PRODUTO', 32, y)
  doc.text('QTD', 120, y)
  doc.text('UN', 135, y)
  doc.text('UNIT (R$)', 150, y)
  doc.text('TOTAL (R$)', 175, y)

  // Itens
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)

  itens.forEach((it) => {
    if (y > 270) {
      doc.addPage()
      y = 20
    }
    const unitStr = it.precoUnitarioCobrado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const subStr = it.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    doc.text(it.codigo, 16, y)
    doc.text(it.nome.slice(0, 48), 32, y)
    doc.text(String(it.quantidade), 120, y)
    doc.text(it.unidade, 135, y)
    doc.text(unitStr, 150, y)
    doc.text(subStr, 175, y)

    y += 6
  })

  // Total
  y += 4
  doc.setDrawColor(203, 213, 225)
  doc.line(14, y, 196, y)

  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(21, 95, 110)
  const totalFmt = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  doc.text(`VALOR TOTAL: ${totalFmt}`, 130, y)

  if (observacoes && observacoes.trim()) {
    y += 10
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(100, 116, 139)
    doc.text(`Observações: ${observacoes.trim()}`, 14, y)
  }

  // Rodapé
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text('Thoth Vendas • Emitido diretamente pelo aplicativo de força de vendas', 14, 285)

  doc.save(`pedido-${new Date().toISOString().slice(0, 10)}.pdf`)
}
