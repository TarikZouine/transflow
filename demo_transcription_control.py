#!/usr/bin/env python3
"""
Démonstration du système robuste de contrôle de transcription
"""

import mysql.connector
import time
import redis
import json

def get_mysql_connection():
    """Connexion MySQL"""
    return mysql.connector.connect(
        unix_socket='/var/run/mysqld/mysqld.sock',
        user='root',
        password='',
        database='transflow'
    )

def show_control_table():
    """Affiche l'état de la table de contrôle"""
    conn = get_mysql_connection()
    cursor = conn.cursor()
    
    print("📊 État de la table transcription_control:")
    cursor.execute("""
        SELECT call_id, is_enabled, 
               DATE_FORMAT(created_at, '%H:%i:%s') as created,
               DATE_FORMAT(updated_at, '%H:%i:%s') as updated,
               TIMESTAMPDIFF(SECOND, last_seen, NOW()) as seconds_ago
        FROM transcription_control 
        ORDER BY updated_at DESC 
        LIMIT 8
    """)
    
    rows = cursor.fetchall()
    for call_id, is_enabled, created, updated, seconds_ago in rows:
        status = "✅ ENABLED" if is_enabled else "❌ DISABLED"
        print(f"  {call_id[:25]}... | {status} | Créé: {created} | MAJ: {updated} | Vu il y a: {seconds_ago}s")
    
    cursor.close()
    conn.close()
    return rows

def enable_call(call_id):
    """Active la transcription pour un appel"""
    conn = get_mysql_connection()
    cursor = conn.cursor()
    
    cursor.execute("UPDATE transcription_control SET is_enabled = TRUE WHERE call_id = %s", (call_id,))
    affected = cursor.rowcount
    conn.commit()
    
    if affected > 0:
        print(f"✅ Transcription ACTIVÉE pour: {call_id}")
    else:
        print(f"⚠️ Appel non trouvé: {call_id}")
    
    cursor.close()
    conn.close()
    return affected > 0

def disable_call(call_id):
    """Désactive la transcription pour un appel"""
    conn = get_mysql_connection()
    cursor = conn.cursor()
    
    cursor.execute("UPDATE transcription_control SET is_enabled = FALSE WHERE call_id = %s", (call_id,))
    affected = cursor.rowcount
    conn.commit()
    
    if affected > 0:
        print(f"❌ Transcription DÉSACTIVÉE pour: {call_id}")
    else:
        print(f"⚠️ Appel non trouvé: {call_id}")
    
    cursor.close()
    conn.close()
    return affected > 0

def monitor_transcriptions(duration=15):
    """Monitore les transcriptions Redis pendant X secondes"""
    print(f"🔍 Monitoring des transcriptions pendant {duration} secondes...")
    
    redis_client = redis.from_url("redis://127.0.0.1:6379/0")
    pubsub = redis_client.pubsub()
    pubsub.subscribe("transcripts.realtime.v2")
    
    start_time = time.time()
    transcript_count = 0
    
    try:
        while time.time() - start_time < duration:
            message = pubsub.get_message(timeout=1)
            if message and message['type'] == 'message':
                transcript_count += 1
                try:
                    data = json.loads(message['data'].decode('utf-8'))
                    call_id = data.get('callId', 'N/A')
                    speaker = data.get('speaker', 'N/A')
                    text = data.get('text', '')
                    status = data.get('status', 'N/A')
                    timestamp = data.get('timestamp', '')
                    
                    print(f"📥 {timestamp} | {call_id[:25]}... ({speaker}) [{status}]: {text[:50]}...")
                except:
                    print(f"📥 Message brut: {message['data'][:100]}...")
                    
        print(f"\n📊 Total transcriptions reçues: {transcript_count}")
        
    finally:
        pubsub.close()

def main():
    """Menu principal"""
    while True:
        print("\n" + "="*80)
        print("🎯 SYSTÈME DE CONTRÔLE DE TRANSCRIPTION - DÉMONSTRATION")
        print("="*80)
        
        rows = show_control_table()
        
        print(f"\n📋 Options:")
        print(f"1. Activer un appel")
        print(f"2. Désactiver un appel")
        print(f"3. Monitorer les transcriptions")
        print(f"4. Test complet (activer → monitor → désactiver)")
        print(f"5. Quitter")
        
        choice = input(f"\n🎯 Choisissez une option (1-5): ").strip()
        
        if choice == "1":
            if rows:
                call_id = rows[0][0]  # Prendre le premier appel
                enable_call(call_id)
            else:
                print("⚠️ Aucun appel disponible")
                
        elif choice == "2":
            if rows:
                # Trouver un appel enabled
                enabled_calls = [row[0] for row in rows if row[1]]
                if enabled_calls:
                    disable_call(enabled_calls[0])
                else:
                    print("⚠️ Aucun appel enabled trouvé")
            else:
                print("⚠️ Aucun appel disponible")
                
        elif choice == "3":
            monitor_transcriptions(20)
            
        elif choice == "4":
            print("\n🧪 TEST COMPLET - Démonstration du système robuste")
            if rows:
                call_id = rows[0][0]
                print(f"\n1️⃣ Activation de l'appel {call_id[:30]}...")
                enable_call(call_id)
                
                print(f"\n2️⃣ Monitoring pendant 15 secondes...")
                monitor_transcriptions(15)
                
                print(f"\n3️⃣ Désactivation de l'appel...")
                disable_call(call_id)
                
                print(f"\n4️⃣ Vérification que les transcriptions s'arrêtent (10s)...")
                monitor_transcriptions(10)
                
                print(f"\n✅ Test complet terminé !")
            else:
                print("⚠️ Aucun appel disponible pour le test")
                
        elif choice == "5":
            print("👋 Au revoir !")
            break
            
        else:
            print("❌ Option invalide")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n🛑 Démonstration interrompue")
    except Exception as e:
        print(f"❌ Erreur: {e}")
