#!/usr/bin/env python3
import sys
from rembg import remove
from PIL import Image
import io
import base64
import json

def process(input_path, output_path):
    with open(input_path, 'rb') as f:
        input_data = f.read()
    output_data = remove(input_data)
    with open(output_path, 'wb') as f:
        f.write(output_data)

if __name__ == '__main__':
    input_path  = sys.argv[1]
    output_path = sys.argv[2]
    process(input_path, output_path)
    print(json.dumps({'ok': True, 'output': output_path}))
