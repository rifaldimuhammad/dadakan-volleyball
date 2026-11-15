import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/** Info pembayaran yang tampil di halaman utama. Diubah admin di /admin/pembayaran. */
export interface PaymentInfo {
  htm: string
  qrisName: string
  /** URL gambar QRIS; kosong = gambar bawaan. */
  qrisImage: string
  note: string
}

export const DEFAULT_QRIS_IMAGE = '/qris-dadakan-volleyball.jpg'

export const DEFAULT_PAYMENT: PaymentInfo = {
  htm: 'Rp 19.000',
  qrisName: 'DADAKAN VOLLEYBALL SPORT',
  qrisImage: DEFAULT_QRIS_IMAGE,
  note: 'Bayar HTM saat datang atau transfer QRIS sebelum main. Simpan bukti untuk konfirmasi admin.',
}

interface Row { htm: string; qris_name: string; qris_image: string | null; note: string }

/** Ambil info pembayaran dari tabel `payment_settings`. Kalau gagal / belum ada, pakai default. */
export async function fetchPaymentInfo(): Promise<PaymentInfo> {
  const { data, error } = await supabase
    .from('payment_settings').select('htm, qris_name, qris_image, note').eq('id', 1).maybeSingle()
  if (error || !data) {
    if (error) console.warn('payment_settings belum tersedia, pakai default:', error.message)
    return DEFAULT_PAYMENT
  }
  const r = data as Row
  return {
    htm: r.htm || DEFAULT_PAYMENT.htm,
    qrisName: r.qris_name || DEFAULT_PAYMENT.qrisName,
    qrisImage: r.qris_image || DEFAULT_QRIS_IMAGE,
    note: r.note ?? DEFAULT_PAYMENT.note,
  }
}

export function usePaymentInfo(): PaymentInfo {
  const [info, setInfo] = useState<PaymentInfo>(DEFAULT_PAYMENT)
  useEffect(() => { fetchPaymentInfo().then(setInfo) }, [])
  return info
}
