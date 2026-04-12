import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import flamengoMatches from '../data/flamengo.json'
import palmeirasMatches from '../data/palmeiras.json'
import cruzeiroMatches from '../data/cruzeiro.json'
import fluminenseMatches from '../data/fluminense.json'
import flamengoProjection from '../data/projections/flamengo.json'
import palmeirasProjection from '../data/projections/palmeiras.json'
import cruzeiroProjection from '../data/projections/cruzeiro.json'
import fluminenseProjection from '../data/projections/fluminense.json'
import lastUpdate from '../data/last.json'

type MatchResult = 'V' | 'E' | 'D' | null

type TeamMatch = {
  matchId: number
  date: string
  status: string
  matchday: number
  adversario: string
  local: 'CASA' | 'FORA'
  resultado: MatchResult
}

type TeamData = {
  teamName: string
  teamShortName: string
  matches: TeamMatch[]
}

type ProjectionData = {
  team: string
  projections: Array<{
    matchId: number
    r: Exclude<MatchResult, null>
  }>
}

type ChartPoint = {
  label: string
  opponent: string
  date: string
  status: string
  pontosPossiveis: number
  realizado: number | null
  realizadoResultado: MatchResult
  projetado: number
  projetadoResultado: Exclude<MatchResult, null> | null
  diferenca: number | null
}

type TeamOption = {
  key: string
  label: string
  matches: TeamData
  projection: ProjectionData
}

type LastUpdateData = {
  updatedAt: string
  timezone: string
}

const TEAM_OPTIONS: TeamOption[] = [
  {
    key: 'flamengo',
    label: 'Flamengo',
    matches: flamengoMatches as TeamData,
    projection: flamengoProjection as ProjectionData,
  },
  {
    key: 'palmeiras',
    label: 'Palmeiras',
    matches: palmeirasMatches as TeamData,
    projection: palmeirasProjection as ProjectionData,
  },
  {
    key: 'cruzeiro',
    label: 'Cruzeiro',
    matches: cruzeiroMatches as TeamData,
    projection: cruzeiroProjection as ProjectionData,
  },
  {
    key: 'fluminense',
    label: 'Fluminense',
    matches: fluminenseMatches as TeamData,
    projection: fluminenseProjection as ProjectionData,
  },
]

const RESULT_POINTS: Record<Exclude<MatchResult, null>, number> = {
  V: 3,
  E: 1,
  D: 0,
}

function App() {
  const [selectedTeamKey, setSelectedTeamKey] = useState('flamengo')
  const [isTeamMenuOpen, setIsTeamMenuOpen] = useState(false)
  const [viewportHeight, setViewportHeight] = useState(() => getViewportHeight())
  const [viewportWidth, setViewportWidth] = useState(() => getViewportWidth())
  const teamPickerRef = useRef<HTMLDivElement | null>(null)

  const selectedTeam = TEAM_OPTIONS.find((option) => option.key === selectedTeamKey) ?? TEAM_OPTIONS[0]
  const displayedTeamName = normalizeTeamName(selectedTeam.matches.teamName)
  const lastUpdatedLabel = formatLastUpdated(lastUpdate as LastUpdateData)

  const chartData = useMemo(
    () => buildChartData(selectedTeam.matches, selectedTeam.projection),
    [selectedTeam],
  )
  const deltaPoints = useMemo(
    () => chartData.filter((item) => item.realizado !== null && item.diferenca !== null),
    [chartData],
  )

  const currentProjection = getCurrentProjectedValue(chartData)
  const currentRealized = getLastRealizedValue(chartData)
  const chartDensity = useMemo(() => getChartDensity(viewportHeight, viewportWidth), [viewportHeight, viewportWidth])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!teamPickerRef.current?.contains(event.target as Node)) {
        setIsTeamMenuOpen(false)
      }
    }

    globalThis.addEventListener('mousedown', handlePointerDown)
    return () => globalThis.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    function handleResize() {
      setViewportHeight(getViewportHeight())
      setViewportWidth(getViewportWidth())
    }

    handleResize()
    globalThis.addEventListener('resize', handleResize)
    return () => globalThis.removeEventListener('resize', handleResize)
  }, [])

  return (
    <main className="app-shell">
      <section className="panel">
        <div className="panel-header">
          <div className="panel-heading">
            <p className="eyebrow">Brasileirão 2026</p>
            <h1>{displayedTeamName}</h1>
            <p className="subtle">Projeção acumulada x desempenho real por confronto</p>
          </div>

          <div className="panel-controls">
            <label className="team-picker">
              <span>Equipe</span>
              <div className={`team-picker-shell${isTeamMenuOpen ? ' is-open' : ''}`} ref={teamPickerRef}>
                <button
                  type="button"
                  className="team-picker-button"
                  onClick={() => setIsTeamMenuOpen((current) => !current)}
                  aria-haspopup="listbox"
                  aria-expanded={isTeamMenuOpen}
                >
                  <span className="team-picker-value">{selectedTeam.label}</span>
                  <span className="team-picker-icon" aria-hidden="true">
                    {isTeamMenuOpen ? '▲' : '▼'}
                  </span>
                </button>

                {isTeamMenuOpen && (
                  <div className="team-picker-menu" role="listbox" aria-label="Seleção de equipe">
                    {TEAM_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        role="option"
                        aria-selected={option.key === selectedTeamKey}
                        className={`team-picker-option${option.key === selectedTeamKey ? ' is-active' : ''}`}
                        onClick={() => {
                          setSelectedTeamKey(option.key)
                          setIsTeamMenuOpen(false)
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>

            <p className="update-stamp">Última atualização: {lastUpdatedLabel}</p>
          </div>
        </div>

        <div className="summary-grid">
          <article className="summary-card">
            <span className="summary-label">Realizado até agora</span>
            <strong>{currentRealized} pts</strong>
          </article>
          <article className="summary-card">
            <span className="summary-label">Projetado até agora</span>
            <strong>{currentProjection} pts</strong>
          </article>
          <article className="summary-card">
            <span className="summary-label">Confrontos finalizados</span>
            <strong>{chartData.filter((item) => item.realizado !== null).length}</strong>
          </article>
        </div>

        <div className="chart-wrap">
          <div className="chart-canvas">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{
                  top: chartDensity === 'compact' ? 8 : 12,
                  right: chartDensity === 'micro' ? 8 : chartDensity === 'compact' ? 8 : 10,
                  left: chartDensity === 'micro' ? 8 : chartDensity === 'compact' ? 8 : 10,
                  bottom: chartDensity === 'compact' ? 24 : chartDensity === 'tight' ? 30 : 54,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(18, 42, 66, 0.12)" />
                <XAxis
                  dataKey="label"
                  angle={chartDensity === 'micro' ? 0 : chartDensity === 'compact' ? -18 : chartDensity === 'tight' ? -24 : -38}
                  textAnchor={chartDensity === 'micro' ? 'middle' : 'end'}
                  interval={0}
                  padding={{ left: chartDensity === 'micro' ? 18 : chartDensity === 'compact' ? 16 : 12, right: chartDensity === 'micro' ? 18 : chartDensity === 'compact' ? 16 : 12 }}
                  minTickGap={chartDensity === 'micro' ? 18 : 8}
                  tickMargin={chartDensity === 'micro' ? 10 : chartDensity === 'compact' ? 6 : chartDensity === 'tight' ? 8 : 12}
                  tick={{ fontSize: chartDensity === 'micro' ? 7 : chartDensity === 'compact' ? 8 : chartDensity === 'tight' ? 9 : 11, fill: '#335c67' }}
                  height={chartDensity === 'micro' ? 34 : chartDensity === 'compact' ? 54 : chartDensity === 'tight' ? 68 : 118}
                  tickFormatter={(value, index) => getChartAxisLabel(String(value), index, chartDensity, chartData.length)}
                />
                <YAxis
                  allowDecimals={false}
                  width={chartDensity === 'compact' ? 28 : 36}
                  tick={{ fontSize: chartDensity === 'compact' ? 10 : 12, fill: '#335c67' }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="projetado"
                  name="Planejado"
                  stroke="#ff8fa3"
                  strokeWidth={3}
                  dot={{ r: chartDensity === 'compact' ? 2 : 3, strokeWidth: 0 }}
                  activeDot={{ r: chartDensity === 'compact' ? 4 : 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="realizado"
                  name="Realizado"
                  stroke="#52b788"
                  strokeWidth={3}
                  dot={{ r: chartDensity === 'compact' ? 2 : 3, strokeWidth: 0 }}
                  connectNulls={false}
                  activeDot={{ r: chartDensity === 'compact' ? 4 : 5 }}
                />
                {deltaPoints.map((point) => {
                  const delta = point.diferenca ?? 0

                  return (
                    <ReferenceDot
                      key={point.label}
                      x={point.label}
                      y={point.realizado ?? point.projetado}
                      r={5}
                      fill={getDeltaColor(delta)}
                      stroke="#08111f"
                      strokeWidth={2}
                      label={{
                        value: formatDelta(delta),
                        position: delta >= 0 ? 'top' : 'bottom',
                        offset: 0,
                        fill: getDeltaColor(delta),
                        fontSize: chartDensity === 'compact' ? 10 : 12,
                        fontWeight: 700,
                      }}
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className={`chart-legend chart-legend-${chartDensity}`} aria-label="Legenda do gráfico">
            <span className="chart-legend-item">
              <span className="chart-legend-swatch chart-legend-swatch-realizado" aria-hidden="true" />
              Realizado
            </span>
            <span className="chart-legend-item">
              <span className="chart-legend-swatch chart-legend-swatch-projetado" aria-hidden="true" />
              Planejado
            </span>
          </div>
        </div>

        <section className="credits-panel" aria-label="Informações adicionais">
          <div className="credits-grid">
            <article className="credits-card">
              <span className="credits-label">Nome</span>
              <strong>Matheus Adriano Martins</strong>
            </article>
            <article className="credits-card">
              <span className="credits-label">Email</span>
              <a href="mailto:matheus.a.martins.77@gmail.com">matheus.a.martins.77@gmail.com</a>
            </article>
            <article className="credits-card">
              <span className="credits-label">Instagram</span>
              <a href="https://instagram.com/math.adr" target="_blank" rel="noreferrer">
                @math.adr
              </a>
            </article>
          </div>

          <p className="credits-note">
            Observação: este gráfico foi elaborado com base nas premissas estabelecidas pelo canal{' '}
            <a href="https://www.youtube.com/@FalsoNove2" target="_blank" rel="noreferrer">
              Falso Nove
            </a>
            .
          </p>
        </section>
      </section>
    </main>
  )
}

function buildChartData(teamData: TeamData, projectionData: ProjectionData): ChartPoint[] {
  const projectionMap = new Map(projectionData.projections.map((item) => [item.matchId, item.r]))

  const sortedMatches = [...teamData.matches].sort((left, right) => {
    const leftPriority = getMatchStatusPriority(left.status)
    const rightPriority = getMatchStatusPriority(right.status)

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority
    }

    return left.date.localeCompare(right.date)
  })

  let realizedTotal = 0
  let projectedTotal = 0

  return sortedMatches.map((match) => {
    const pontosPossiveis = match.matchday * 3
    const projectedResult = projectionMap.get(match.matchId)
    if (projectedResult) {
      projectedTotal += RESULT_POINTS[projectedResult]
    }

    let realizedValue: number | null = null
    if (match.status === 'FINISHED' && match.resultado) {
      realizedTotal += RESULT_POINTS[match.resultado]
      realizedValue = realizedTotal
    }

    return {
      label: `${normalizeTeamName(match.adversario)} (${match.local === 'CASA' ? 'C' : 'F'})`,
      opponent: normalizeTeamName(match.adversario),
      date: formatDate(match.date),
      status: translateStatus(match.status),
      pontosPossiveis,
      realizado: realizedValue,
      realizadoResultado: match.status === 'FINISHED' ? match.resultado : null,
      projetado: projectedTotal,
      projetadoResultado: projectedResult ?? null,
      diferenca: realizedValue === null ? null : realizedValue - projectedTotal,
    }
  })
}

function getMatchStatusPriority(status: string) {
  switch (status) {
    case 'FINISHED':
      return 0
    case 'IN_PLAY':
      return 0
    case 'TIMED':
    case 'SCHEDULED':
      return 1
    case 'POSTPONED':
      return 2
    default:
      return 1
  }
}

function getCurrentProjectedValue(data: ChartPoint[]) {
  const lastFinishedIndex = data.findLastIndex((item) => item.realizado !== null)

  if (lastFinishedIndex === -1) {
    return 0
  }

  return data[lastFinishedIndex]?.projetado ?? 0
}

type ChartDensity = 'default' | 'tight' | 'compact' | 'micro'

function getViewportHeight() {
  return typeof globalThis.window === 'undefined' ? 1080 : globalThis.window.innerHeight
}

function getViewportWidth() {
  return typeof globalThis.window === 'undefined' ? 1440 : globalThis.window.innerWidth
}

function getChartDensity(viewportHeight: number, viewportWidth: number): ChartDensity {
  if (viewportWidth <= 760 || viewportHeight <= 600) {
    return 'micro'
  }

  if (viewportWidth <= 960 || viewportHeight <= 760) {
    return 'compact'
  }

  if (viewportWidth <= 1280 || viewportHeight <= 820) {
    return 'tight'
  }

  return 'default'
}

function getChartAxisLabel(label: string, index: number, density: ChartDensity, totalTicks: number) {
  if (density === 'default') {
    return index === 0 || index === totalTicks - 1 ? compactAxisLabel(label, 'tight') : label
  }

  if (density === 'micro' && index % 5 !== 0) {
    return ''
  }

  if (density === 'compact' && index % 3 !== 0) {
    return ''
  }

  if (density === 'tight' && index % 2 !== 0) {
    return ''
  }

  return compactAxisLabel(label, density)
}

function compactAxisLabel(label: string, density: ChartDensity) {
  const shortLabel = label
    .replace(/\s*\((C|F)\)$/, ' ($1)')
    .replace(/\bClube do\b/g, 'C. do')
    .replace(/\bVasco da\b/g, 'Vasco d.')
    .replace(/\bAtlético\b/g, 'Atl.')
    .replace(/\bCorinthians\b/g, 'Cor.')
    .replace(/\bPalmeiras\b/g, 'Pal.')
    .replace(/\bFluminense\b/g, 'Flu.')
    .replace(/\bFlamengo\b/g, 'Fla.')
    .replace(/\bCruzeiro\b/g, 'Cru.')
    .replace(/\bInternacional\b/g, 'Inter')
    .replace(/\bChapecoense\b/g, 'Chape')
    .replace(/\bBragantino\b/g, 'Braga')
    .replace(/\bParanaense\b/g, 'CAP')

  const maxLength = density === 'micro' ? 6 : density === 'compact' ? 10 : 14
  return shortLabel.length > maxLength ? `${shortLabel.slice(0, maxLength - 1)}…` : shortLabel
}

function getLastRealizedValue(data: ChartPoint[]) {
  const realizedValues = data
    .map((item) => item.realizado)
    .filter((value): value is number => value !== null)

  return realizedValues.at(-1) ?? 0
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(date))
}

function formatLastUpdated(lastUpdateData: LastUpdateData) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: lastUpdateData.timezone,
  }).format(new Date(lastUpdateData.updatedAt))
}

function normalizeTeamName(value: string) {
  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return value
  }
}

function translateStatus(value: string) {
  const statusMap: Record<string, string> = {
    FINISHED: 'Finalizado',
    IN_PLAY: 'Em andamento',
    TIMED: 'Agendado',
    SCHEDULED: 'Agendado',
    POSTPONED: 'Adiado',
  }

  return statusMap[value] ?? value
}

function formatDelta(value: number | null) {
  if (value === null) {
    return ''
  }

  if (value === 0) {
    return '0'
  }

  return `${value > 0 ? '+' : ''}${value}`
}

function getDeltaColor(value: number | null) {
  if (value === null || value === 0) {
    return '#ffd166'
  }

  return value > 0 ? '#52b788' : '#ff8fa3'
}

function translateMatchResult(value: MatchResult) {
  switch (value) {
    case 'V':
      return 'V'
    case 'E':
      return 'E'
    case 'D':
      return 'D'
    default:
      return '-'
  }
}

function formatPercentage(value: number | null, total: number) {
  if (value === null || total <= 0) {
    return '-'
  }

  return `${((value / total) * 100).toFixed(1)}%`
}

type TooltipProps = {
  active?: boolean
  payload?: Array<{
    value: number | null
    name: string
    color: string
    payload?: ChartPoint
  }>
  label?: string
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) {
    return null
  }

  const point = payload[0]?.payload
  if (!point) {
    return null
  }

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      <span>{point.date}</span>
      <span>Status: {point.status}</span>
      {payload.map((entry) => (
        <span key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value ?? '-'} pts {`(${formatPercentage(entry.value, point.pontosPossiveis)}, ${entry.name === 'Realizado' ? translateMatchResult(point.realizadoResultado) : translateMatchResult(point.projetadoResultado)})`}
        </span>
      ))}
    </div>
  )
}

export default App



