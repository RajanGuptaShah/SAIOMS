import requests
import base64

def test_vision():
    # create a dummy image
    from PIL import Image
    import io
    img = Image.new('RGB', (100, 100), color = 'red')
    buf = io.BytesIO()
    img.save(buf, format='JPEG')
    b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    
    url = "https://text.pollinations.ai/openai"
    payload = {
        "model": "openai",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "What color is this image?"},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}
                ]
            }
        ]
    }
    try:
        r = requests.post(url, json=payload)
        print("Status:", r.status_code)
        print("Response:", r.text)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_vision()
