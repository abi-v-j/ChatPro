import base64
import json
import numpy as np

def verify_face(image_base64: str, stored_encoding: str) -> bool:
    try:
        # Decode base64 and parse JSON
        received_data = json.loads(base64.b64decode(image_base64).decode())
        stored_data = json.loads(base64.b64decode(stored_encoding).decode())
        
        # Convert to list if dictionary (handle {"0": ..., "1": ...} format)
        if isinstance(received_data, dict):
            received_data = [received_data[str(i)] for i in range(len(received_data))]
        if isinstance(stored_data, dict):
            stored_data = [stored_data[str(i)] for i in range(len(stored_data))]
        
        # Convert to NumPy arrays
        received_encoding = np.array(received_data, dtype=np.float32)
        stored_encoding_data = np.array(stored_data, dtype=np.float32)
        
        # Compute Euclidean distance
        distance = np.linalg.norm(received_encoding - stored_encoding_data)
        return distance < 0.6
    except Exception as e:
        print(f"Face verification error: {e}")
        return False