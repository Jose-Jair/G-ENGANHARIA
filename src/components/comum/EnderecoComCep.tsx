import React, { useState, useEffect } from 'react'
import { cepService, ESTADOS_BRASIL } from '@/services/cep'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MapPin, Search, Loader2, AlertCircle, HelpCircle, Check } from 'lucide-react'

export interface EnderecoValue {
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
}

export interface EnderecoComCepProps {
  value: EnderecoValue
  onChange: (value: EnderecoValue) => void
  readOnly?: boolean
  required?: boolean
  label?: string
}

export const EnderecoComCep: React.FC<EnderecoComCepProps> = ({
  value,
  onChange,
  readOnly = false,
  required = false,
  label = 'Endereço',
}) => {
  const [loadingCep, setLoadingCep] = useState(false)
  const [cepMensagem, setCepMensagem] = useState<{
    tipo: 'sucesso' | 'aviso' | 'erro'
    texto: string
  } | null>(null)
  const [modoManual, setModoManual] = useState(false)
  const [municipiosIbge, setMunicipiosIbge] = useState<string[]>([])
  const [loadingMunicipios, setLoadingMunicipios] = useState(false)

  // Quando a UF muda (especialmente no modo manual), busca os municípios via API do IBGE
  useEffect(() => {
    if (!value.uf) {
      setMunicipiosIbge([])
      return
    }

    let isMounted = true
    const carregarMunicipios = async () => {
      setLoadingMunicipios(true)
      try {
        const nomes = await cepService.listarMunicipiosPorUf(value.uf!)
        if (isMounted) {
          setMunicipiosIbge(nomes)
        }
      } catch {
        if (isMounted) setMunicipiosIbge([])
      } finally {
        if (isMounted) setLoadingMunicipios(false)
      }
    }

    carregarMunicipios()
    return () => {
      isMounted = false
    }
  }, [value.uf])

  const handleFieldChange = (field: keyof EnderecoValue, val: string) => {
    onChange({
      ...value,
      [field]: val,
    })
  }

  // Busca automática do CEP na ViaCEP ao completar 8 dígitos
  const handleCepChange = async (cepInput: string) => {
    const formatado = cepService.formatCep(cepInput)
    const clean = cepService.cleanCep(cepInput)

    onChange({
      ...value,
      cep: formatado,
    })

    if (clean.length < 8) {
      setCepMensagem(null)
      return
    }

    if (clean.length === 8) {
      setLoadingCep(true)
      setCepMensagem(null)
      try {
        const endereco = await cepService.consultarCep(clean)
        if (endereco) {
          onChange({
            ...value,
            cep: endereco.cep,
            logradouro: endereco.logradouro || value.logradouro || '',
            bairro: endereco.bairro || value.bairro || '',
            municipio: endereco.municipio || value.municipio || '',
            uf: endereco.uf || value.uf || '',
            complemento: endereco.complemento || value.complemento || '',
          })
          setCepMensagem({
            tipo: 'sucesso',
            texto: `${endereco.municipio}/${endereco.uf} preenchido automaticamente pela ViaCEP.`,
          })
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha ao buscar CEP.'
        setCepMensagem({
          tipo: 'aviso',
          texto: `${msg} Os campos abaixo permanecem editáveis manualmente.`,
        })
      } finally {
        setLoadingCep(false)
      }
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-orange-600" />
          {label} {required && <span className="text-red-500">*</span>}
        </Label>

        {!readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setModoManual(!modoManual)}
            className="h-6 text-[11px] text-blue-600 hover:text-blue-800 px-1.5 gap-1"
          >
            <HelpCircle className="w-3 h-3" />
            {modoManual ? 'Buscar por CEP' : 'Não sei o CEP (UF → Município)'}
          </Button>
        )}
      </div>

      {/* Alerta / Mensagem do CEP */}
      {cepMensagem && (
        <div
          className={`px-2.5 py-1.5 rounded text-[11px] flex items-center gap-1.5 ${
            cepMensagem.tipo === 'sucesso'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}
        >
          {cepMensagem.tipo === 'sucesso' ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          )}
          <span>{cepMensagem.texto}</span>
        </div>
      )}

      {/* Linha 1: CEP (ou seletor de UF e Município quando em modo manual) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-slate-600">CEP</Label>
            {loadingCep && (
              <span className="text-[10px] text-blue-600 flex items-center gap-1">
                <Loader2 className="w-2.5 h-2.5 animate-spin" /> ViaCEP...
              </span>
            )}
          </div>
          <div className="relative">
            <Input
              value={value.cep || ''}
              onChange={(e) => handleCepChange(e.target.value)}
              placeholder="00000-000"
              maxLength={9}
              disabled={readOnly}
              className="text-xs h-8 font-mono pr-7 bg-white"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2 pointer-events-none" />
          </div>
        </div>

        {/* UF */}
        <div className="space-y-1">
          <Label className="text-[11px] text-slate-600">UF</Label>
          {!readOnly && modoManual ? (
            <Select value={value.uf || ''} onValueChange={(val) => handleFieldChange('uf', val)}>
              <SelectTrigger className="text-xs h-8 bg-white">
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {ESTADOS_BRASIL.map((uf) => (
                  <SelectItem key={uf.sigla} value={uf.sigla} className="text-xs">
                    {uf.sigla} - {uf.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={value.uf || ''}
              onChange={(e) => handleFieldChange('uf', e.target.value.toUpperCase())}
              placeholder="UF"
              maxLength={2}
              disabled={readOnly}
              className="text-xs h-8 uppercase font-mono bg-white"
            />
          )}
        </div>

        {/* Município */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-slate-600">Município</Label>
            {loadingMunicipios && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Loader2 className="w-2.5 h-2.5 animate-spin" /> IBGE...
              </span>
            )}
          </div>
          {!readOnly && modoManual && municipiosIbge.length > 0 ? (
            <Select
              value={value.municipio || ''}
              onValueChange={(val) => handleFieldChange('municipio', val)}
            >
              <SelectTrigger className="text-xs h-8 bg-white">
                <SelectValue placeholder="Selecione o Município (IBGE)" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {municipiosIbge.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={value.municipio || ''}
              onChange={(e) => handleFieldChange('municipio', e.target.value)}
              placeholder="Ex: São Paulo"
              disabled={readOnly}
              className="text-xs h-8 bg-white"
            />
          )}
        </div>
      </div>

      {/* Linha 2: Logradouro + Número */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <div className="sm:col-span-3 space-y-1">
          <Label className="text-[11px] text-slate-600">Logradouro / Rua / Avenida</Label>
          <Input
            value={value.logradouro || ''}
            onChange={(e) => handleFieldChange('logradouro', e.target.value)}
            placeholder="Ex: Av. Paulista"
            disabled={readOnly}
            className="text-xs h-8 bg-white"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-slate-600">Número</Label>
          <Input
            value={value.numero || ''}
            onChange={(e) => handleFieldChange('numero', e.target.value)}
            placeholder="Ex: 1000 ou S/N"
            disabled={readOnly}
            className="text-xs h-8 bg-white"
          />
        </div>
      </div>

      {/* Linha 3: Complemento + Bairro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-slate-600">Complemento</Label>
          <Input
            value={value.complemento || ''}
            onChange={(e) => handleFieldChange('complemento', e.target.value)}
            placeholder="Ex: Sala 402, Bloco B"
            disabled={readOnly}
            className="text-xs h-8 bg-white"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-slate-600">Bairro</Label>
          <Input
            value={value.bairro || ''}
            onChange={(e) => handleFieldChange('bairro', e.target.value)}
            placeholder="Ex: Bela Vista"
            disabled={readOnly}
            className="text-xs h-8 bg-white"
          />
        </div>
      </div>
    </div>
  )
}
