s=[2,83,1,11,13,140]
#s=[2,50,83,30]
# count the number of pairs in the list
def counting(s):
    l=len(s)
    count=0
    t=[0]*l
    for i in range(l):
        if s[i]%10==0:
            t[i]=s[i]//10
        else:
            t[i]=s[i]
        print(s[i]%10,s[i]//10)
    print(t)
    for i in range(l):
        for j in range(len(s)):
            if s[i]+s[j]==t[j]+t[i]:
                print(s[i],s[j],t[j],t[i],s[i]+s[j]==t[j]+t[i])
                count+=1
    return count
print("Output Count:",counting(s))