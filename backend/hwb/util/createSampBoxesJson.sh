#!/bin/bash

string="$(curl https://www.harzer-wandernadel.de/stempelstellen/uebersichtskarte/ | grep mapp.data.push)"
# cut inlcuding ( with #*(
string="${string#*(}"
# cut trailing ); by removing last 3 characters
echo "${string::-3}"  > "$(date +"%Y_%m_%d_%I_%M_%p")_stampBoxes.json"
