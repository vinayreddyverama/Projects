s  = 'sxppcivrymqkwxxyzwkuouqz'
temp=''
result=''
#Longest substring in alphabetical order in the string s
for i in range(len(s)-1):
    if (s[i]<=s[i+1]):
        temp+=s[i]
    else:
        temp+=s[i]
        if (len(temp) > len(result)):
            result = temp
        temp=''
        
if (i==len(s)-2 and s[i]<=s[i+1]):
        temp+=s[i+1]
if (len(temp) > len(result)):
    print(temp,i, s[i])
    result = temp
print('Longest substring in alphabetical order in the string s:',result)
