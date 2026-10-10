import { describe, it, expect } from 'vitest'
import { validateBasicRules, completeAIResult, buildAIPrompt } from '../services/aiService.js'

// Datos de prueba base: pedido válido de inventario
const base = {
  garmentSource: 'inventory',
  product: 'Jersey deportivo',
  productType: 'Jersey',
  size: 'M',
  technique: 'DTF',
  quantity: 12,
  customizationSide: 'frente'
}

describe('validateBasicRules — reglas generales del pedido', () => {
  it('PU-01 pedido completo y válido no genera error bloqueante', () => {
    const r = validateBasicRules(base)
    expect(r.hasBlockingError).toBe(false)
    expect(r.result.riskLevel).toBe('bajo')
    expect(r.result.warnings).toHaveLength(0)
  })
  it('PU-02 origen de prenda inválido se bloquea', () => {
    const r = validateBasicRules({ ...base, garmentSource: 'otro' })
    expect(r.hasBlockingError).toBe(true)
    expect(r.result.warnings).toContain('El origen de la prenda no es válido.')
  })
  it('PU-03 prenda proporcionada por el cliente es un origen válido', () => {
    const r = validateBasicRules({ ...base, garmentSource: 'customer' })
    expect(r.hasBlockingError).toBe(false)
  })
  it('PU-04 pedido sin talla se bloquea', () => {
    const r = validateBasicRules({ ...base, size: '' })
    expect(r.hasBlockingError).toBe(true)
    expect(r.result.warnings).toContain('Debe seleccionar una talla.')
  })
  it('PU-05 técnica fuera del catálogo (Serigrafía) se bloquea', () => {
    const r = validateBasicRules({ ...base, technique: 'Serigrafía' })
    expect(r.hasBlockingError).toBe(true)
    expect(r.result.warnings).toContain('La técnica seleccionada no es válida.')
  })
  it('PU-06 lado de personalización inválido se bloquea', () => {
    const r = validateBasicRules({ ...base, customizationSide: 'manga' })
    expect(r.hasBlockingError).toBe(true)
  })
  it('PU-07 lado en mayúsculas ("Ambos") se acepta', () => {
    const r = validateBasicRules({ ...base, customizationSide: 'Ambos' })
    expect(r.hasBlockingError).toBe(false)
  })
  it('PU-08 cantidad cero se bloquea', () => {
    const r = validateBasicRules({ ...base, quantity: 0 })
    expect(r.hasBlockingError).toBe(true)
    expect(r.result.warnings).toContain('La cantidad debe ser mayor a 0.')
  })
  it('PU-09 cantidad negativa se bloquea', () => {
    const r = validateBasicRules({ ...base, quantity: -5 })
    expect(r.hasBlockingError).toBe(true)
  })
  it('PU-10 cantidad no numérica ("abc") se bloquea', () => {
    const r = validateBasicRules({ ...base, quantity: 'abc' })
    expect(r.hasBlockingError).toBe(true)
  })
  it('PU-11 varios errores simultáneos se reportan todos', () => {
    const r = validateBasicRules({ ...base, size: '', technique: 'X', quantity: 0 })
    expect(r.result.warnings.length).toBe(3)
  })
})

describe('completeAIResult — reglas de producción posteriores a la IA', () => {
  it('PU-12 respuesta vacía de IA se completa con valores seguros', () => {
    const r = completeAIResult({}, { technique: 'DTF' })
    expect(r.riskLevel).toBe('medio')
    expect(Array.isArray(r.warnings)).toBe(true)
    expect(r.recommendation.length).toBeGreaterThan(0)
  })
  it('PU-13 nivel de riesgo desconocido se normaliza a "medio"', () => {
    const r = completeAIResult({ riskLevel: 'critico' }, { technique: 'DTF' })
    expect(r.riskLevel).toBe('medio')
  })
  it('PU-14 sublimación sobre prenda color "Negro" se marca riesgo alto', () => {
    const r = completeAIResult({ riskLevel: 'bajo' }, { technique: 'Sublimación', productColor: 'Negro', product: 'Playera' })
    expect(r.riskLevel).toBe('alto')
    expect(r.isTechniqueRecommended).toBe(false)
  })
  it('PU-15 sublimación sobre prenda color "Negra" se marca riesgo alto', () => {
    const r = completeAIResult({ riskLevel: 'bajo' }, { technique: 'Sublimación', productColor: 'Negra', product: 'Jersey' })
    expect(r.riskLevel).toBe('alto')
    expect(r.isTechniqueRecommended).toBe(false)
  })
  it('PU-16 sublimación sobre prenda blanca se mantiene recomendada', () => {
    const r = completeAIResult({ riskLevel: 'bajo', isTechniqueRecommended: true }, { technique: 'Sublimación', productColor: 'Blanco' })
    expect(r.riskLevel).toBe('bajo')
    expect(r.isTechniqueRecommended).toBe(true)
  })
  it('PU-17 bordado con degradado o fotografía se marca riesgo alto', () => {
    const r = completeAIResult({ riskLevel: 'bajo', warnings: ['El logo contiene degradado'] }, { technique: 'Bordado' })
    expect(r.riskLevel).toBe('alto')
    expect(r.warnings).toContain('El diseño puede ser demasiado complejo para bordado.')
  })
  it('PU-18 DTF sobre prenda oscura no se rechaza', () => {
    const r = completeAIResult({ riskLevel: 'bajo', isTechniqueRecommended: true }, { technique: 'DTF', productColor: 'Negro' })
    expect(r.isTechniqueRecommended).toBe(true)
  })
  it('PU-19 advertencias duplicadas no se repiten', () => {
    const w = 'La sublimación no es recomendable sobre prendas base oscuras.'
    const r = completeAIResult({ warnings: [w] }, { technique: 'Sublimación', productColor: 'Negro' })
    expect(r.warnings.filter(x => x === w)).toHaveLength(1)
  })
})

describe('buildAIPrompt — construcción de la instrucción para la IA', () => {
  it('PU-20 el prompt incluye los datos del pedido y los textos agregados', () => {
    const p = buildAIPrompt({ ...base, productColor: 'Rojo', textElements: ['PÉREZ 10'], imageElements: [{}] })
    expect(p).toContain('Jersey deportivo')
    expect(p).toContain('PÉREZ 10')
    expect(p).toContain('Cantidad:\n1')
  })
  it('PU-21 el prompt exige respuesta solo en JSON', () => {
    const p = buildAIPrompt(base)
    expect(p).toContain('Responde únicamente JSON válido.')
  })
})
