import random

arr = []
anagram = ""
word = input("Enter word to scramble: ")

for i in word:
    arr.append(i)

random.shuffle(arr)
for i in arr:
    anagram += i

print(f"{anagram}")
