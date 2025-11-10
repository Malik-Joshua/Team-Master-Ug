'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { FileText, Download, Filter, Calendar, BarChart3, TrendingUp, Users, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Report {
  id: string
  title: string
  type: 'player' | 'match' | 'training' | 'financial' | 'summary'
  dateRange: string
  generatedAt: string
  status: 'ready' | 'generating' | 'error'
}

export default function ReportsPage() {
  const [user, setUser] = useState<any>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilter, setShowFilter] = useState(false)
  const [filterData, setFilterData] = useState({
    reportType: 'all',
    dateFrom: '',
    dateTo: '',
  })

  useEffect(() => {
    const loadData = async () => {
      // Check for dev mode
      if (typeof window !== 'undefined') {
        const devUser = localStorage.getItem('dev_user')
        if (devUser) {
          try {
            const userData = JSON.parse(devUser)
            setUser(userData)
            // Mock reports data for dev mode
            const mockReports: Report[] = [
              {
                id: '1',
                title: 'Player Performance Summary - Q4 2024',
                type: 'player',
                dateRange: 'Oct 1 - Dec 31, 2024',
                generatedAt: new Date().toISOString(),
                status: 'ready',
              },
              {
                id: '2',
                title: 'Match Statistics Report - November',
                type: 'match',
                dateRange: 'Nov 1 - Nov 30, 2024',
                generatedAt: new Date(Date.now() - 86400000).toISOString(),
                status: 'ready',
              },
              {
                id: '3',
                title: 'Training Attendance Analysis',
                type: 'training',
                dateRange: 'Oct 1 - Nov 8, 2024',
                generatedAt: new Date(Date.now() - 172800000).toISOString(),
                status: 'ready',
              },
              {
                id: '4',
                title: 'Monthly Summary Report',
                type: 'summary',
                dateRange: 'Nov 1 - Nov 30, 2024',
                generatedAt: new Date(Date.now() - 3600000).toISOString(),
                status: 'generating',
              },
            ]
            setReports(mockReports)
            setLoading(false)
            return
          } catch (e) {
            // Fall through
          }
        }
      }

      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (authUser) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .single()

        if (profile) {
          setUser(profile)
          // Fetch real reports
        }
      }
      setLoading(false)
    }

    loadData()
  }, [])

  const handleGenerateReport = (type: string) => {
    // In dev mode, just add to reports
    if (typeof window !== 'undefined' && localStorage.getItem('dev_user')) {
      const newReport: Report = {
        id: Date.now().toString(),
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Report - ${new Date().toLocaleDateString()}`,
        type: type as Report['type'],
        dateRange: filterData.dateFrom && filterData.dateTo
          ? `${new Date(filterData.dateFrom).toLocaleDateString()} - ${new Date(filterData.dateTo).toLocaleDateString()}`
          : new Date().toLocaleDateString(),
        generatedAt: new Date().toISOString(),
        status: 'generating',
      }
      setReports([newReport, ...reports])
      
      // Simulate generation
      setTimeout(() => {
        setReports((prev) =>
          prev.map((r) => (r.id === newReport.id ? { ...r, status: 'ready' as const } : r))
        )
      }, 2000)
      
      alert('Report generation started! (Dev Mode)')
      return
    }
    alert('Report generation started!')
  }

  const handleDownload = (reportId: string) => {
    // In dev mode, just show alert
    if (typeof window !== 'undefined' && localStorage.getItem('dev_user')) {
      alert('Report downloaded! (Dev Mode)')
      return
    }
    alert('Report downloaded!')
  }

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'player':
        return Users
      case 'match':
        return Trophy
      case 'training':
        return Calendar
      case 'financial':
        return BarChart3
      default:
        return FileText
    }
  }

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case 'player':
        return 'bg-primary'
      case 'match':
        return 'bg-secondary'
      case 'training':
        return 'bg-info'
      case 'financial':
        return 'bg-success'
      default:
        return 'bg-warning'
    }
  }

  if (loading) {
    return (
      <Layout pageTitle="Reports">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  if (!user) return null

  const filteredReports = reports.filter((report) => {
    if (filterData.reportType !== 'all' && report.type !== filterData.reportType) return false
    return true
  })

  return (
    <Layout pageTitle="Reports">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-extrabold text-club-gradient mb-2">Reports</h1>
            <p className="text-lg text-neutral-medium font-medium">Generate and manage data reports</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowFilter(!showFilter)}
              className="bg-white text-neutral-text px-6 py-3 rounded-button font-semibold hover:bg-neutral-light transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center border border-neutral-light"
            >
              <Filter className="w-5 h-5 mr-2" />
              Filter
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilter && (
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <h2 className="text-xl font-bold text-neutral-text mb-4">Filter Reports</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-2">Report Type</label>
                <select
                  value={filterData.reportType}
                  onChange={(e) => setFilterData({ ...filterData, reportType: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                >
                  <option value="all">All Types</option>
                  <option value="player">Player Reports</option>
                  <option value="match">Match Reports</option>
                  <option value="training">Training Reports</option>
                  <option value="financial">Financial Reports</option>
                  <option value="summary">Summary Reports</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-2">Date From</label>
                <input
                  type="date"
                  value={filterData.dateFrom}
                  onChange={(e) => setFilterData({ ...filterData, dateFrom: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-2">Date To</label>
                <input
                  type="date"
                  value={filterData.dateTo}
                  onChange={(e) => setFilterData({ ...filterData, dateTo: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* Quick Generate Reports */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft hover-lift cursor-pointer">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-neutral-text">Player Report</h3>
                <p className="text-sm text-neutral-medium">Performance & stats</p>
              </div>
            </div>
            <button
              onClick={() => handleGenerateReport('player')}
              className="w-full px-4 py-2 bg-primary text-white rounded-button font-medium hover:bg-primary-dark transition-colors text-sm"
            >
              Generate
            </button>
          </div>

          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft hover-lift cursor-pointer">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-neutral-text">Match Report</h3>
                <p className="text-sm text-neutral-medium">Match statistics</p>
              </div>
            </div>
            <button
              onClick={() => handleGenerateReport('match')}
              className="w-full px-4 py-2 bg-secondary text-white rounded-button font-medium hover:bg-secondary-dark transition-colors text-sm"
            >
              Generate
            </button>
          </div>

          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft hover-lift cursor-pointer">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-info rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-neutral-text">Training Report</h3>
                <p className="text-sm text-neutral-medium">Attendance & sessions</p>
              </div>
            </div>
            <button
              onClick={() => handleGenerateReport('training')}
              className="w-full px-4 py-2 bg-info text-white rounded-button font-medium hover:bg-info-dark transition-colors text-sm"
            >
              Generate
            </button>
          </div>

          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft hover-lift cursor-pointer">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-warning rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-neutral-text">Summary Report</h3>
                <p className="text-sm text-neutral-medium">Overall summary</p>
              </div>
            </div>
            <button
              onClick={() => handleGenerateReport('summary')}
              className="w-full px-4 py-2 bg-warning text-white rounded-button font-medium hover:bg-warning-dark transition-colors text-sm"
            >
              Generate
            </button>
          </div>
        </div>

        {/* Reports List */}
        <div className="bg-white rounded-card border border-neutral-light shadow-soft overflow-hidden">
          <div className="p-6 border-b border-neutral-light">
            <h2 className="text-2xl font-bold text-neutral-text">Generated Reports</h2>
          </div>
          {filteredReports.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-neutral-light rounded-full mb-4">
                <FileText className="w-10 h-10 text-neutral-medium" />
              </div>
              <h3 className="text-xl font-bold text-neutral-text mb-2">No Reports Found</h3>
              <p className="text-neutral-medium">Generate your first report using the options above</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-light">
              {filteredReports.map((report) => {
                const Icon = getReportTypeIcon(report.type)
                const typeColor = getReportTypeColor(report.type)
                return (
                  <div
                    key={report.id}
                    className="p-6 hover:bg-neutral-light transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className={`${typeColor} w-12 h-12 rounded-xl flex items-center justify-center`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-neutral-text mb-1">{report.title}</h3>
                          <div className="flex items-center space-x-4 text-sm text-neutral-medium">
                            <span className="capitalize">{report.type} Report</span>
                            <span>•</span>
                            <span>{report.dateRange}</span>
                            <span>•</span>
                            <span>Generated {new Date(report.generatedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {report.status === 'ready' && (
                          <button
                            onClick={() => handleDownload(report.id)}
                            className="px-4 py-2 bg-club-gradient text-white rounded-button font-medium hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </button>
                        )}
                        {report.status === 'generating' && (
                          <div className="flex items-center space-x-2 text-info">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-info"></div>
                            <span className="text-sm font-medium">Generating...</span>
                          </div>
                        )}
                        {report.status === 'error' && (
                          <span className="text-sm font-medium text-secondary">Error</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Report Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Total Reports"
            value={reports.length}
            icon={FileText}
            iconColor="bg-primary"
            description="All generated reports"
          />
          <StatCard
            title="Ready Reports"
            value={reports.filter((r) => r.status === 'ready').length}
            icon={TrendingUp}
            iconColor="bg-success"
            description="Available for download"
          />
          <StatCard
            title="This Month"
            value={reports.filter((r) => {
              const reportDate = new Date(r.generatedAt)
              const now = new Date()
              return reportDate.getMonth() === now.getMonth() && reportDate.getFullYear() === now.getFullYear()
            }).length}
            icon={BarChart3}
            iconColor="bg-info"
            description="Reports generated this month"
          />
        </div>
      </div>
    </Layout>
  )
}


