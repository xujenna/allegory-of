import os
from os.path import splitext
import json
import piexif
from PIL import Image
import datetime
import time
import pytz

docs = os.listdir("./files/")
with open("doc_data.json", "r") as infile:
    doc_data = json.load(infile)

timezone = pytz.timezone('America/New_York')

for doc in docs:
    fileInfo = {}
    file_name,extension = splitext("./files/" + doc)
    if ("Screenshot" not in file_name) and (extension == ".jpg" or extension == ".png"):
        img = Image.open("./files/" + doc)
        date_time_str = img._getexif()[36867]
        date_time_obj = datetime.datetime.strptime(date_time_str, "%Y:%m:%d %H:%M:%S")
        timezone_date_time_obj = timezone.localize(date_time_obj)
        timestamp = time.mktime(timezone_date_time_obj.timetuple())

        fileInfo['timestamp'] = timestamp
        fileInfo['fileName'] = doc
    else:
        fileInfo['timestamp'] = os.stat("./files/" + doc).st_birthtime
        fileInfo['fileName'] = doc
    doc_data.append(fileInfo)


with open("doc_data.json", "w") as outfile:
    json.dump(doc_data, outfile, indent=2)