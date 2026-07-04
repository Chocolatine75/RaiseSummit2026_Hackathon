# PA clip scripts — generate with AI Studio TTS (Japanese voice), then convert

Generate each line as its own clip. Convert for the Listener:

```bash
ffmpeg -i pa1.mp3 -f s16le -acodec pcm_s16le -ar 16000 -ac 1 pa1.pcm
```

| Clip | Japanese (paste into TTS) | Meaning (for your rehearsal script) |
|---|---|---|
| pa1 | 地震が発生しました。落ち着いて行動してください。 | An earthquake has occurred. Please act calmly. |
| pa2 | 西口へ避難してください。係員の指示に従ってください。 | Evacuate via the west exit. Follow staff instructions. |
| pa3 | 東口は閉鎖されています。南階段は使用できません。 | The east exit is closed. The south stairs cannot be used. |

Sign to print (A4, thick marker, tape it to a wall for the camera beat):

# この出口閉鎖
### (This exit is closed)
