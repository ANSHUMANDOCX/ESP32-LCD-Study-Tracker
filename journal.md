# ESP32 LCD Study Tracker

Its a Study tracker that helps you be productive while studying along with maintaining a day wise log online on the website hosted on the ESP32 itself

# 2026-09-06: Made an enclosure for the board 

**Total time spent: 2 hours**

Worked on making a enclosure for this device i intentionally lowered the buttons since the buttons i am using are a bit siff and they need some support while being pressed so if i added them to the side or at the top then it would only be a matter of time that they would come out so .. this is what i came up with ![Screenshot_2026-09-06_124511.png](https://cdn.hackclub.com/01a075ac-b7e4-7091-9c87-23142f39608e/Screenshot_2026-09-06_124511.png)
![Screenshot_2026-09-06_131053.png](https://cdn.hackclub.com/01a075ac-b96e-70a8-a9ef-e7c1ea7472cb/Screenshot_2026-09-06_131053.png)
![Screenshot_2026-09-06_121933.png](https://cdn.hackclub.com/01a075ac-b83a-7c10-ac94-fe3cdea7586a/Screenshot_2026-09-06_121933.png)

# 2026-07-20: Some problems 

**Total time spent: 0.3 hours**

Found out that the I2c connector for the LCd is no longer working so, i will have to get a new one for the Display ![image.png](https://cdn.hackclub.com/019f80f2-4712-7863-8c97-bb7240f25e9a/image.png)

# 2026-07-19: Looking for More stuff

**Total time spent: 0.3 hours**

Finding the right sized standoffs that i will need to connect the display to the PCB. I am thinking of using 12mm ones since they are big enough to support the whole thing and allowing it to stand upright in the mean time ![image.png](https://cdn.hackclub.com/019f7bcc-92ff-73e9-a51f-bb15275e4494/image.png)

# 2026-07-18: organizing the Schematic 

**Total time spent: 0.5 hours**

Made the schematic look more readable by sorting everything in sections for better understanding for everyone.I like making my schematics arranged this way.![image.png](https://cdn.hackclub.com/019f76cc-8201-754d-afc7-79a88b1c8021/image.png)

# 2026-07-17: Completed Placement and PCB

**Total time spent: 3 hours**

Completed all the placement of the components and the routing also along with 
- added brightness control. Which is a 10k potentiometer connected to the led pin and +5v to control the brightness 
- Also the placement of the buttons is such that if one wants to use it without a case they can.
- Also there is a spare 5v header pin for giving 5v directly and not having to use the type c always and clutter my desk with wires.
- the 5v rails are a bit thicker than normal since 0.2mm is not quite optimal for currents higher than 0.7 amps and considering that the lcd has backlight along with the ESP32 running with wifi on i increased it to 0.5mm
- there is also a debug led onboard for checking if everything thing is in order lol
 ![image.png](https://cdn.hackclub.com/019f7197-d25e-7179-92ea-0391e0708649/image.png)![image.png](https://cdn.hackclub.com/019f7198-6d75-7807-b7cf-ba91ab916313/image.png)

# 2026-07-16: PCB Design 

**Total time spent: 0.5 hours**

Started by arranging the components of the power section first the type c port power regulator and the caps. This the part where all the components need to properly arranged to maximize their efficiency also to suit my purpose like the header pin for 5v in is there to help me connect the 5v from another device i alr have on my desk so i wont need extra cable to connect this .![image.png](https://cdn.hackclub.com/019f6c82-8816-7f66-b78e-2f3164b9a5ce/image.png)

# 2026-07-15: UART + Power connections

**Total time spent: 1.5 hours**

Wired the onboard programmer along with the voltage regulator and the I2C pins for connecting the LCD to it. 
- I have used the ch343 Onboard programmer for this since i already had this chip on hand and the design is also not very complicated.
-  And for the Voltage regulator i have used the ME6217 3.3v LDO its a very efficient chip and also works very well with the esp32 module this the go to chip i use while designing a esp32 based board.![image.png](https://cdn.hackclub.com/019f671c-808b-787b-81cb-37c9c625919d/image.png)![image.png](https://cdn.hackclub.com/019f671c-e568-7e19-8dee-05e523db91c6/image.png)

# 2026-07-15: Schematic Design

**Total time spent: 2 hours**

Since this a Pretty simple project along with it i already have the parts i am going to use to research was not needed except looking at esp32e Wroom module schematic also i will be using a I2c adapter along with the LCD since this simplifies the design along with that i have both of things lying around so ... 
![image.png](https://cdn.hackclub.com/019f6626-e185-7981-a35e-78f53ffeb770/image.png)