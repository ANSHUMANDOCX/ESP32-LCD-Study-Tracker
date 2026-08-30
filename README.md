# ESP32-LCD-Study-Tracker
Its a Compact Server based study tracker using a OLED display and a ESP32 that help one track their study/work time on particular subjects and also lets use set a target using the interactive web page hosted on the ESP

# Parts used 
- Esp32 Wroom
- 1602 LCD Display
- PCB with onboard programmer

# Features
- The system uses Display to set timer and keep track of your productive hours. It also has a webpage hosted on the ESP that helps you check on the hours spent at a glance. Also one can set target for the day how much time one needs to be productive for.
- It also has a Log system that logs the time we have spent on something and helps us keep track of how productive one has been. It also has a option to download the log all together as a csv file.
- There is a header for Connecting the LCD using I2C
- There are 3 Buttons for controlling the Display 'Start' , 'Stop' and , 'Change'.
- We can long press the STOP button to turnoff the backlight of the lcd since it could be distracting for some of us.

# Programming
The code is very simple you will need to import the project in platform io and once flash the system image to load the website on the ESP and next upload the main.c file thats it. Also the subject/ Topic one needs to focus on is under a placeholder so anyone can change it according to their needs.  

# PCB and Schematic
<img width="1016" height="427" alt="image" src="https://github.com/user-attachments/assets/4fd445bd-c8af-4f44-bb31-30f03f96f22e" />
<img width="639" height="260" alt="image" src="https://github.com/user-attachments/assets/a3e543e0-446c-422c-adaa-5a907abbe7ba" />
<img width="685" height="318" alt="image" src="https://github.com/user-attachments/assets/71344dc0-5700-4214-b9ec-a0479cfb8c6c" />


# BOM
| Serial No | Product name          | Quantity | Supplier |   Price | Total | Link                                                      |
| --------: | --------------------- | -------: | -------- | ------: | ----: | --------------------------------------------------------- |
|         1 | RC0603JR-070RL        |      100 | LCSC     | $0.0034 | $0.34 | [LCSC](https://www.lcsc.com/product-detail/C95177.html)   |
|         2 | ME6217C33M5G          |        5 | LCSC     | $0.1219 | $0.61 | [LCSC](https://www.lcsc.com/product-detail/C427602.html)  |
|         3 | CH343P                |        1 | LCSC     | $1.1227 | $1.12 | [LCSC](https://www.lcsc.com/product-detail/C2846043.html) |
|         4 | ESP32-WROOM-32E-N4    |        1 | LCSC     | $3.7668 | $3.77 | [LCSC](https://www.lcsc.com/product-detail/C701341.html)  |
|         5 | TS-1088-AR02016       |       10 | LCSC     | $0.0531 | $0.53 | [LCSC](https://www.lcsc.com/product-detail/C720477.html)  |
|         6 | GT-TC060A-H025-L1S    |        5 | LCSC     | $0.0929 | $0.46 | [LCSC](https://www.lcsc.com/product-detail/C7450623.html) |
|         7 | FRC0603F2201TS        |      100 | LCSC     | $0.0022 | $0.22 | [LCSC](https://www.lcsc.com/product-detail/C2907005.html) |
|         8 | FRC0603F5101TS        |      100 | LCSC     | $0.0021 | $0.21 | [LCSC](https://www.lcsc.com/product-detail/C2907044.html) |
|         9 | RC0603FR-0710KL       |      100 | LCSC     | $0.0040 | $0.40 | [LCSC](https://www.lcsc.com/product-detail/C98220.html)   |
|        10 | CL10B104KB8NNNC       |      200 | LCSC     | $0.0118 | $2.36 | [LCSC](https://www.lcsc.com/product-detail/C1591.html)    |
|        11 | FRC0603F1001TS        |      100 | LCSC     | $0.0029 | $0.29 | [LCSC](https://www.lcsc.com/product-detail/C2907002.html) |
|        12 | SS8050                |       50 | LCSC     | $0.0100 | $0.50 | [LCSC](https://www.lcsc.com/product-detail/C916392.html)  |
|        13 | TYPE-C 16PIN 2MD(073) |       20 | LCSC     | $0.0707 | $1.41 | [LCSC](https://www.lcsc.com/product-detail/C2765186.html) |
|        14 | GRM188R60J476ME15D    |        5 | LCSC     | $0.1934 | $0.97 | [LCSC](https://www.lcsc.com/product-detail/C140782.html)  |
|        15 | CL10A475KP8NNNC       |       50 | LCSC     | $0.0199 | $1.00 | [LCSC](https://www.lcsc.com/product-detail/C1705.html)    |
|        16 | CL10B105KA8NNNC       |       10 | LCSC     | $0.0216 | $0.22 | [LCSC](https://www.lcsc.com/product-detail/C29936.html)   |
|        17 | CL10A106KP8NNNC       |       20 | LCSC     | $0.0353 | $0.71 | [LCSC](https://www.lcsc.com/product-detail/C19702.html)   |
|        18 | PCB       |       1 | JLC     | $2 | $2 | [JLC](jlcpcb.com)   |
|19|LCD Display|1|Robu|$2|$2|[Robu](https://robu.in/product/lcd1602-parallel-lcd-display-with-iic-i2c-interface/)|
||**TOTAL**||||20|||
