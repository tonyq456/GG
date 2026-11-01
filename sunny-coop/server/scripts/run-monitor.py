#!/usr/bin/env python3
"""Invoke this private Site using a freshly retrieved Sites service token via stdin.
Never store a service token in source, a task prompt, shell arguments, or a file.
Input: {"url":"https://...chatgpt.site", "token":"...", "action":"run"}
"""
import json,sys,urllib.request,urllib.error
from urllib.parse import urlparse
if sys.stdin.isatty():
 import termios
 flags=termios.tcgetattr(sys.stdin.fileno()); flags[3]&=~termios.ECHO
 termios.tcsetattr(sys.stdin.fileno(),termios.TCSANOW,flags)
 print('Ready for private Site access JSON on stdin (input hidden).',flush=True)
v=json.loads(sys.stdin.readline());base=v['url'].rstrip('/')
if base!='https://fangyuan-flock-weather.a0321000000.chatgpt.site':raise ValueError('Unexpected Site')
token=v['token'];headers={'OAI-Sites-Authorization':'Bearer '+token,'Content-Type':'application/json'}
action=v.get('action','run')
if action=='schedule':
 path='/api/coop/schedule';payload=json.dumps({'id':v['id'],'enabled':v['enabled']}).encode()
else:path='/api/coop/run';payload=b'{}'
req=urllib.request.Request(base+path,data=payload,headers=headers,method='POST')
try:
 with urllib.request.urlopen(req,timeout=120) as r:result=json.load(r)
 with urllib.request.urlopen(urllib.request.Request(base+'/api/coop/heartbeat',headers=headers),timeout=30) as r:heartbeat=json.load(r)
 print(json.dumps({'result':result,'readback':heartbeat},ensure_ascii=False),flush=True)
except urllib.error.HTTPError as e:
 print(json.dumps({'error':'Site request failed','status':e.code,'body':e.read(1000).decode(errors='replace')},ensure_ascii=False),flush=True);sys.exit(1)
