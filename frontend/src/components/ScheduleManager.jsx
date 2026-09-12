import React, { useState } from 'react'
import { Clock, Plus, Trash2 } from 'lucide-react'

export default function ScheduleManager({ selectedPlatforms }) {
  const [schedules, setSchedules] = useState([])
  const [newSchedule, setNewSchedule] = useState({ time: '09:00', interval: '24' })

  const addSchedule = () => {
    if (!newSchedule.time) return
    setSchedules([...schedules, { ...newSchedule, id: Date.now() }])
    setNewSchedule({ time: '09:00', interval: '24' })
  }

  const deleteSchedule = (id) => {
    setSchedules(schedules.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Add Schedule Form */}
      <div className="bg-white rounded-lg p-6 shadow">
        <h3 className="font-bold text-lg mb-4">⏰ Yeni Zamanlama</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block font-medium text-sm mb-2">Başlangıç Saati</label>
            <input
              type="time"
              value={newSchedule.time}
              onChange={(e) => setNewSchedule({ ...newSchedule, time: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block font-medium text-sm mb-2">Aralık (Saat)</label>
            <select
              value={newSchedule.interval}
              onChange={(e) => setNewSchedule({ ...newSchedule, interval: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {[1, 2, 4, 6, 8, 12, 24].map(h => (
                <option key={h} value={h}>Her {h} saatte</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={addSchedule}
              className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Ekle
            </button>
          </div>
        </div>
      </div>

      {/* Schedule List */}
      <div className="bg-white rounded-lg p-6 shadow">
        <h3 className="font-bold text-lg mb-4">📅 Aktif Zamanlamalar</h3>
        {schedules.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock size={40} className="mx-auto mb-2 opacity-30" />
            <p>Henüz zamanlama eklenmedi</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map(schedule => (
              <div key={schedule.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">🕒 {schedule.time} - Her {schedule.interval} saatte</p>
                  <p className="text-sm text-gray-600">
                    Platformlar: {selectedPlatforms.join(', ') || 'Seçili değil'}
                  </p>
                </div>
                <button
                  onClick={() => deleteSchedule(schedule.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border-l-4 border-primary p-6 rounded">
        <h4 className="font-bold text-primary mb-2">💡 Nasıl Çalışır?</h4>
        <p className="text-gray-700">
          Otomatik zamanlama özelliği, belirlediğiniz saatlerde ve aralıklarda içeriği seçili tüm platformlara otomatik olarak yayınlar.
        </p>
      </div>
    </div>
  )
}
