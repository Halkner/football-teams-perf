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
  roundLabel: string
  opponent: string
  date: string
  status: string
  local: 'CASA' | 'FORA'
  matchday: number
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

type ViewportMode = 'mobile' | 'tablet' | 'desktop'

type ChartConfig = {
  canvasWidth: string
  margin: { top: number; right: number; left: number; bottom: number }
  xAxisDataKey: 'label' | 'roundLabel'
  xAxisAngle: number
  xAxisHeight: number
  xAxisPadding: { left: number; right: number }
  minTickGap: number
  tickMargin: number
  tickFontSize: number
  yAxisWidth: number
  yAxisFontSize: number
  strokeWidth: number
  dotRadius: number
  activeDotRadius: number
  referenceDotRadius: number
  deltaFontSize: number
  showDeltaLabels: boolean
  showVerticalGrid: boolean
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
  const [viewportWidth, setViewportWidth] = useState(() => getViewportWidth())
  const [selectedPointLabel, setSelectedPointLabel] = useState<string | null>(null)
  const [detailMode, setDetailMode] = useState<'latest' | 'selected'>('latest')
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
  const viewportMode = useMemo(() => getViewportMode(viewportWidth), [viewportWidth])
  const chartConfig = useMemo(() => getChartConfig(viewportMode, chartData.length), [viewportMode, chartData.length])
  const selectedPoint =
    chartData.find((item) => item.label === selectedPointLabel) ??
    getDefaultSelectedPoint(chartData) ??
    chartData[0] ??
    null

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!teamPickerRef.current?.contains(event.target as Node)) {
        setIsTeamMenuOpen(false)
      }
    }

    globalThis.addEventListener('pointerdown', handlePointerDown)
    return () => globalThis.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    function handleResize() {
      setViewportWidth(getViewportWidth())
    }

    handleResize()
    globalThis.addEventListener('resize', handleResize)
    return () => globalThis.removeEventListener('resize', handleResize)
  }, [])

  return (
    <main className="app-shell">
      <section className={`panel panel-${viewportMode}`}>
        <div className="panel-header">
          <div className="panel-heading">
            <p className="eyebrow">Brasileirão 2026</p>
            <h1>{displayedTeamName}</h1>
            <p className="subtle">
              {viewportMode === 'mobile'
                ? 'Projeção acumulada x desempenho real'
                : 'Projeção acumulada x desempenho real por confronto'}
            </p>
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
                          const nextChartData = buildChartData(option.matches, option.projection)
                          setSelectedPointLabel(
                            getDefaultSelectedPoint(nextChartData)?.label ?? nextChartData[0]?.label ?? null,
                          )
                          setDetailMode('latest')
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
          <div className={`chart-scroll-shell${viewportMode === 'mobile' ? ' is-mobile' : ''}`}>
            <div className="chart-canvas" style={{ width: chartConfig.canvasWidth }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={chartConfig.margin}
                  onClick={(state) => {
                    const activePoint = (
                      state as unknown as { activePayload?: Array<{ payload?: ChartPoint }> }
                    )?.activePayload?.[0]?.payload
                    if (activePoint) {
                      setSelectedPointLabel(activePoint.label)
                      setDetailMode('selected')
                    }
                  }}
                >
                  <CartesianGrid
                    strokeDasharray={chartConfig.showVerticalGrid ? '3 3' : '0'}
                    vertical={chartConfig.showVerticalGrid}
                    stroke="rgba(18, 42, 66, 0.12)"
                  />
                  <XAxis
                    dataKey={chartConfig.xAxisDataKey}
                    angle={chartConfig.xAxisAngle}
                    textAnchor={chartConfig.xAxisAngle === 0 ? 'middle' : 'end'}
                    interval={0}
                    padding={chartConfig.xAxisPadding}
                    minTickGap={chartConfig.minTickGap}
                    tickMargin={chartConfig.tickMargin}
                    tick={{ fontSize: chartConfig.tickFontSize, fill: '#335c67' }}
                    height={chartConfig.xAxisHeight}
                    tickFormatter={(value, index) =>
                      getChartAxisLabel(String(value), index, viewportMode, chartData.length)
                    }
                  />
                  <YAxis
                    allowDecimals={false}
                    width={chartConfig.yAxisWidth}
                    tick={{ fontSize: chartConfig.yAxisFontSize, fill: '#335c67' }}
                  />
                  <Tooltip content={<ChartTooltip viewportMode={viewportMode} />} />
                  <Line
                    type="monotone"
                    dataKey="projetado"
                    name="Planejado"
                    stroke="#ff8fa3"
                    strokeWidth={chartConfig.strokeWidth}
                    dot={{ r: chartConfig.dotRadius, strokeWidth: 0 }}
                    activeDot={{ r: chartConfig.activeDotRadius }}
                  />
                  <Line
                    type="monotone"
                    dataKey="realizado"
                    name="Realizado"
                    stroke="#52b788"
                    strokeWidth={chartConfig.strokeWidth}
                    dot={{ r: chartConfig.dotRadius, strokeWidth: 0 }}
                    connectNulls={false}
                    activeDot={{ r: chartConfig.activeDotRadius }}
                  />
                  {deltaPoints.map((point) => {
                    const delta = point.diferenca ?? 0

                    return (
                      <ReferenceDot
                        key={point.label}
                        x={chartConfig.xAxisDataKey === 'roundLabel' ? point.roundLabel : point.label}
                        y={point.realizado ?? point.projetado}
                        r={chartConfig.referenceDotRadius}
                        fill={getDeltaColor(delta)}
                        stroke="#08111f"
                        strokeWidth={2}
                        label={
                          chartConfig.showDeltaLabels
                            ? {
                                value: formatDelta(delta),
                                position: delta >= 0 ? 'top' : 'bottom',
                                offset: 0,
                                fill: getDeltaColor(delta),
                                fontSize: chartConfig.deltaFontSize,
                                fontWeight: 700,
                              }
                            : undefined
                        }
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {viewportMode === 'mobile' ? (
            <p className="chart-mobile-hint">Arraste na horizontal para ver todas as rodadas e toque em um ponto para atualizar o card abaixo.</p>
          ) : null}
          <div className={`chart-legend chart-legend-${viewportMode}`} aria-label="Legenda do gráfico">
            <span className="chart-legend-item">
              <span className="chart-legend-swatch chart-legend-swatch-realizado" aria-hidden="true" />
              Realizado
            </span>
            <span className="chart-legend-item">
              <span className="chart-legend-swatch chart-legend-swatch-projetado" aria-hidden="true" />
              Planejado
            </span>
          </div>
          {viewportMode === 'mobile' && selectedPoint ? (
            <article className="chart-detail-card" aria-label="Detalhes do confronto selecionado">
              <div className="chart-detail-header">
                <div className="chart-detail-title-group">
                  <span className="chart-detail-kicker">
                    {detailMode === 'selected' ? 'Confronto selecionado no gráfico' : 'Último confronto finalizado'}
                  </span>
                  <strong>{selectedPoint.opponent}</strong>
                </div>
                <span>{selectedPoint.date}</span>
              </div>
              <div className="chart-detail-grid">
                <span>Rodada: {selectedPoint.matchday}</span>
                <span>Local: {selectedPoint.local === 'CASA' ? 'Casa' : 'Fora'}</span>
                <span>Status: {selectedPoint.status}</span>
                <span>Realizado: {selectedPoint.realizado ?? '-'} pts</span>
                <span>Planejado: {selectedPoint.projetado} pts</span>
                <span>Delta: {formatDelta(selectedPoint.diferenca)}</span>
              </div>
            </article>
          ) : null}
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
              <a href="https://www.instagram.com/matheusadriano7" target="_blank" rel="noreferrer">
                @matheusadriano7
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
      roundLabel: `R${match.matchday}`,
      opponent: normalizeTeamName(match.adversario),
      date: formatDate(match.date),
      status: translateStatus(match.status),
      local: match.local,
      matchday: match.matchday,
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

function getViewportWidth() {
  return typeof globalThis.window === 'undefined' ? 1440 : globalThis.window.innerWidth
}

function getViewportMode(viewportWidth: number): ViewportMode {
  if (viewportWidth < 768) {
    return 'mobile'
  }

  if (viewportWidth < 1024) {
    return 'tablet'
  }

  return 'desktop'
}

function getChartConfig(viewportMode: ViewportMode, totalPoints: number): ChartConfig {
  if (viewportMode === 'mobile') {
    return {
      canvasWidth: `${Math.max(totalPoints * 34, 760)}px`,
      margin: { top: 12, right: 8, left: 0, bottom: 20 },
      xAxisDataKey: 'roundLabel',
      xAxisAngle: 0,
      xAxisHeight: 30,
      xAxisPadding: { left: 10, right: 10 },
      minTickGap: 14,
      tickMargin: 6,
      tickFontSize: 10,
      yAxisWidth: 28,
      yAxisFontSize: 10,
      strokeWidth: 3,
      dotRadius: 2,
      activeDotRadius: 5,
      referenceDotRadius: 4,
      deltaFontSize: 10,
      showDeltaLabels: false,
      showVerticalGrid: false,
    }
  }

  if (viewportMode === 'tablet') {
    return {
      canvasWidth: '100%',
      margin: { top: 12, right: 10, left: 8, bottom: 38 },
      xAxisDataKey: 'label',
      xAxisAngle: -24,
      xAxisHeight: 70,
      xAxisPadding: { left: 12, right: 12 },
      minTickGap: 8,
      tickMargin: 8,
      tickFontSize: 9,
      yAxisWidth: 36,
      yAxisFontSize: 11,
      strokeWidth: 3,
      dotRadius: 3,
      activeDotRadius: 5,
      referenceDotRadius: 5,
      deltaFontSize: 11,
      showDeltaLabels: true,
      showVerticalGrid: false,
    }
  }

  return {
    canvasWidth: '100%',
    margin: { top: 12, right: 10, left: 10, bottom: 54 },
    xAxisDataKey: 'label',
    xAxisAngle: -38,
    xAxisHeight: 118,
    xAxisPadding: { left: 12, right: 12 },
    minTickGap: 8,
    tickMargin: 12,
    tickFontSize: 11,
    yAxisWidth: 36,
    yAxisFontSize: 12,
    strokeWidth: 3,
    dotRadius: 3,
    activeDotRadius: 5,
    referenceDotRadius: 5,
    deltaFontSize: 12,
    showDeltaLabels: true,
    showVerticalGrid: true,
  }
}

function getChartAxisLabel(label: string, index: number, viewportMode: ViewportMode, totalTicks: number) {
  if (viewportMode === 'mobile') {
    return index === 0 || index === totalTicks - 1 || index % 4 === 0 ? label : ''
  }

  if (viewportMode === 'desktop') {
    return index === 0 || index === totalTicks - 1 ? compactAxisLabel(label, 'tablet') : label
  }

  if (viewportMode === 'tablet' && index % 2 !== 0) {
    return ''
  }

  return compactAxisLabel(label, viewportMode)
}

function compactAxisLabel(label: string, viewportMode: ViewportMode) {
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

  const maxLength = viewportMode === 'mobile' ? 8 : viewportMode === 'tablet' ? 10 : 14
  return shortLabel.length > maxLength ? `${shortLabel.slice(0, maxLength - 1)}…` : shortLabel
}

function getDefaultSelectedPoint(data: ChartPoint[]) {
  return [...data].reverse().find((item) => item.realizado !== null) ?? data[0] ?? null
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
  if (!/[Ãâ]/.test(value)) {
    return value
  }

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
    return '-'
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
  viewportMode: ViewportMode
  active?: boolean
  payload?: Array<{
    value: number | null
    name: string
    color: string
    payload?: ChartPoint
  }>
  label?: string
}

function ChartTooltip({ active, payload, label, viewportMode }: TooltipProps) {
  if (!active || !payload?.length) {
    return null
  }

  const point = payload[0]?.payload
  if (!point) {
    return null
  }

  return (
    <div className={`chart-tooltip chart-tooltip-${viewportMode}`}>
      <strong>{viewportMode === 'mobile' ? `${point.opponent} • ${point.roundLabel}` : label}</strong>
      <span>{point.date}</span>
      <span>Status: {point.status}</span>
      {payload.map((entry) => (
        <span key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value ?? '-'} pts{' '}
          {`(${formatPercentage(entry.value, point.pontosPossiveis)}, ${
            entry.name === 'Realizado'
              ? translateMatchResult(point.realizadoResultado)
              : translateMatchResult(point.projetadoResultado)
          })`}
        </span>
      ))}
    </div>
  )
}

export default App
