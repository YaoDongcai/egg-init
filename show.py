#!/usr/bin/python
# -*- coding: UTF-8 -*-
import sys
import time
import RPi.GPIO as GPIO
arg1 =  sys.argv[1]
print arg1
GPIO.setmode(GPIO.BOARD)
GPIO.setup(12, GPIO.OUT)
  
p = GPIO.PWM(12, 50)
p.start(0)
step = 5
p.ChangeDutyCycle(step * 5)
time.sleep(0.02)
p.ChangeDutyCycle(0)
p.ChangeDutyCycle(step * 5)
time.sleep(5)
p.ChangeDutyCycle(0)
try:
    while(True):
        step = float(arg1)
        p.ChangeDutyCycle(step * 5)
except KeyboardInterrupt:
    pass
p.stop()
GPIO.cleanup()


