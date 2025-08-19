#!/usr/bin/env python3
"""
Test script pour vérifier que le système de transcription respecte la table transcription_control
"""

import mysql.connector
import time
import redis

# Configuration
REDIS_URL = "redis://127.0.0.1:6379/0"
CHANNEL = "transcripts.realtime.v2"

def get_mysql_connection():
    """Connexion MySQL"""
    return mysql.connector.connect(
        unix_socket='/var/run/mysqld/mysqld.sock',
        user='root',
        password='',
        database='transflow'
    )

def test_transcription_control():
    """Test du contrôle de transcription"""
    print("🧪 Test du système de contrôle de transcription")
    
    # Connexion MySQL
    conn = get_mysql_connection()
    cursor = conn.cursor()
    
    # Connexion Redis
    redis_client = redis.from_url(REDIS_URL)
    
    print("📊 État actuel de la table transcription_control:")
    cursor.execute("SELECT call_id, is_enabled FROM transcription_control")
    rows = cursor.fetchall()
    
    for call_id, is_enabled in rows:
        status = "✅ ENABLED" if is_enabled else "❌ DISABLED"
        print(f"  {call_id}: {status}")
    
    if not rows:
        print("  ⚠️ Aucun appel dans la table")
        return
    
    print("\n🔍 Monitoring Redis pendant 30 secondes pour vérifier les transcriptions...")
    print("Si le système est robuste, AUCUNE transcription ne devrait apparaître pour les appels DISABLED")
    
    # Créer un subscriber Redis
    pubsub = redis_client.pubsub()
    pubsub.subscribe(CHANNEL)
    
    start_time = time.time()
    transcript_count = 0
    
    try:
        while time.time() - start_time < 30:  # 30 secondes de monitoring
            message = pubsub.get_message(timeout=1)
            if message and message['type'] == 'message':
                transcript_count += 1
                data = message['data'].decode('utf-8')
                print(f"📥 Transcription reçue: {data[:100]}...")
                
        if transcript_count == 0:
            print("\n✅ SUCCÈS: Aucune transcription reçue - le système respecte bien la table de contrôle !")
        else:
            print(f"\n⚠️ ATTENTION: {transcript_count} transcriptions reçues alors que tous les appels sont DISABLED")
            print("   Le système ne respecte PAS complètement la table de contrôle")
            
    except KeyboardInterrupt:
        print("\n🛑 Test interrompu")
    
    finally:
        pubsub.close()
        cursor.close()
        conn.close()

def enable_test_call():
    """Active un appel de test pour vérifier que la transcription démarre"""
    print("\n🔧 Activation d'un appel de test...")
    
    conn = get_mysql_connection()
    cursor = conn.cursor()
    
    # Prendre le premier appel et l'activer
    cursor.execute("SELECT call_id FROM transcription_control LIMIT 1")
    row = cursor.fetchone()
    
    if row:
        call_id = row[0]
        cursor.execute("UPDATE transcription_control SET is_enabled = TRUE WHERE call_id = %s", (call_id,))
        conn.commit()
        print(f"✅ Appel {call_id} activé pour test")
        
        print("⏳ Attendre 10 secondes pour voir si la transcription démarre...")
        time.sleep(10)
        
        # Désactiver à nouveau
        cursor.execute("UPDATE transcription_control SET is_enabled = FALSE WHERE call_id = %s", (call_id,))
        conn.commit()
        print(f"❌ Appel {call_id} désactivé")
    else:
        print("⚠️ Aucun appel trouvé pour le test")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    test_transcription_control()
    
    print("\n" + "="*60)
    response = input("Voulez-vous tester l'activation d'un appel ? (y/n): ")
    if response.lower() == 'y':
        enable_test_call()
