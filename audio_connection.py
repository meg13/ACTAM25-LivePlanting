import asyncio
import websockets
import numpy as np
import struct

async def audio_generator(websocket, path):
    sample_rate = 44100
    frequency = 440  # La nota A
    chunk_size = 4096
    
    try:
        while True:
            # Genera sinusoide
            t = np.linspace(0, chunk_size/sample_rate, chunk_size)
            audio_data = np.sin(2 * np.pi * frequency * t).astype(np.float32)
            
            # Invia al browser
            await websocket.send(audio_data.tobytes())
            
            # Aspetta un po' prima del prossimo chunk
            await asyncio.sleep(chunk_size / sample_rate)
            
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")

# Avvia server
start_server = websockets.serve(audio_generator, "localhost", 8765)
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()